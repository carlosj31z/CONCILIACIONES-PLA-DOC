import type { Prisma, ConciliationRecord } from "@prisma/client";
import { prisma } from "../db";
import { buildNuevoRequerimientoEmail, buildRecetaListaEmail } from "./email.templates";
import type { TriggerCorreo } from "../types/enums";

interface EncolarCorreoParams {
  record: ConciliationRecord;
  trigger: TriggerCorreo;
  destinatarios: string[];
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

// Encola un correo en la tabla EmailLog (outbox). No lo envía: la request
// HTTP del usuario retorna de inmediato y un worker en background hace el
// envío real, con reintentos si SMTP falla. Esto es lo que hace que el
// envío sea "invisible" para el usuario y no dependa de su cliente Outlook.
export async function encolarCorreo({ record, trigger, destinatarios, tx }: EncolarCorreoParams) {
  const db = tx ?? prisma;

  const { subject, html } =
    trigger === "NUEVO_REQUERIMIENTO"
      ? buildNuevoRequerimientoEmail(record)
      : buildRecetaListaEmail(record);

  await db.emailRecipient.createMany({
    data: destinatarios.map((email) => ({ recordId: record.id, email, trigger })),
  });

  await db.emailLog.create({
    data: {
      recordId: record.id,
      trigger,
      destinatarios: JSON.stringify(destinatarios),
      asunto: subject,
      cuerpoHtml: html,
    },
  });
}
