import type { Prisma, ConciliationRecord, TriggerCorreo } from "@prisma/client";
import { prisma } from "../db";
import {
  buildDecisionPlaneamientoEmail,
  buildNuevoRequerimientoEmail,
  buildRecetaListaEmail,
  buildRechazoTecnicoEmail,
} from "./email.templates";

interface EncolarCorreoParams {
  record: ConciliationRecord;
  trigger: TriggerCorreo;
  destinatarios: string[];
  /** Solo para RECHAZO_TECNICO y DECISION_PLANEAMIENTO. */
  motivo?: string;
  /** Solo para DECISION_PLANEAMIENTO: true = concluida, false = rechazada. */
  aprobado?: boolean;
  /** Solo para RECETA_LISTA: observaciones que dejó Documentación Técnica en la página. */
  observaciones?: string | null;
  /** Permite reutilizar una transacción abierta por el controlador que cambia el estado. */
  tx?: Prisma.TransactionClient;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizarDestinatarios(emails: string[]): string[] {
  const limpios = emails
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);

  const invalidos = limpios.filter((e) => !EMAIL_REGEX.test(e));
  if (invalidos.length > 0) {
    throw new Error(`Correo(s) inválido(s): ${invalidos.join(", ")}`);
  }

  return Array.from(new Set(limpios));
}

// Encola un correo en la tabla EmailLog (outbox), dentro de la misma
// transacción que el cambio de estado que lo origina. Devuelve la fila
// creada para que el controlador, ya fuera de la transacción, dispare el
// envío inline (`enviarCorreoInmediato`) sin arriesgar un correo huérfano
// si la transacción llegara a fallar.
export async function encolarCorreo({
  record,
  trigger,
  destinatarios,
  motivo,
  aprobado,
  observaciones,
  tx,
}: EncolarCorreoParams) {
  const db = tx ?? prisma;

  const { subject, html } = (() => {
    switch (trigger) {
      case "NUEVO_REQUERIMIENTO":
        return buildNuevoRequerimientoEmail(record);
      case "RECHAZO_TECNICO":
        return buildRechazoTecnicoEmail(record, motivo ?? "");
      case "DECISION_PLANEAMIENTO":
        return buildDecisionPlaneamientoEmail(record, aprobado ?? true, motivo);
      case "RECETA_LISTA":
      default:
        return buildRecetaListaEmail(record, observaciones);
    }
  })();

  await db.emailRecipient.createMany({
    data: destinatarios.map((email) => ({ recordId: record.id, email, trigger })),
  });

  return db.emailLog.create({
    data: {
      recordId: record.id,
      trigger,
      destinatarios: JSON.stringify(destinatarios),
      asunto: subject,
      cuerpoHtml: html,
    },
  });
}
