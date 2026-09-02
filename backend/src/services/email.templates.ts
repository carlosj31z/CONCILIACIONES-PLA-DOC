import type { ConciliationRecord } from "@prisma/client";
import { config } from "../config";

const wrapper = (title: string, bodyHtml: string) => `
<!doctype html>
<html lang="es">
  <body style="margin:0;background:#f4f5f7;font-family:Segoe UI,Arial,sans-serif;color:#1f2933;">
    <table role="presentation" width="100%" style="padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e4e7eb;">
            <tr>
              <td style="background:#0b3d91;padding:20px 28px;">
                <span style="color:#ffffff;font-size:16px;font-weight:600;">Conciliaciones</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h2 style="margin:0 0 16px;font-size:18px;color:#0b3d91;">${title}</h2>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background:#f8f9fb;border-top:1px solid #e4e7eb;">
                <span style="font-size:12px;color:#8792a2;">Correo automático, no responder. Generado por el sistema de Conciliaciones.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

/**
 * Todo lo que escribe un usuario pasa por acá antes de ir al HTML del
 * correo. Sin esto, un "&" o un "<" en el motivo rompía el mensaje, y un
 * texto con etiquetas se habría insertado como marcado en la bandeja de
 * quien lo recibe.
 */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Dato corto y de una sola línea: producto, planta, fecha. Va en la ficha. */
const dato = (label: string, value: string) => `
  <tr>
    <td style="padding:7px 14px 7px 0;font-size:13px;color:#6b7684;white-space:nowrap;vertical-align:top;">${escapar(label)}</td>
    <td style="padding:7px 0;font-size:14px;color:#1f2933;font-weight:600;">${escapar(value)}</td>
  </tr>`;

const ficha = (filas: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 4px;">${filas}</table>`;

/**
 * Texto libre que el usuario escribió en un textarea: motivo, materiales,
 * asuntos regulatorios, motivos de rechazo. Va en su propio bloque, con el
 * título encima y respetando los saltos de línea — antes se metía en la
 * misma línea que la etiqueta y un texto de varios párrafos quedaba como un
 * bloque corrido ilegible.
 */
const bloque = (label: string, value: string) => `
  <div style="margin:18px 0 0;">
    <div style="font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#6b7684;margin:0 0 6px;">${escapar(label)}</div>
    <div style="font-size:14px;line-height:1.55;color:#1f2933;background:#f8f9fb;border:1px solid #e4e7eb;border-left:3px solid #0b3d91;border-radius:0 6px 6px 0;padding:12px 14px;white-space:pre-wrap;word-break:break-word;">${escapar(value)}</div>
  </div>`;

const parrafo = (texto: string) =>
  `<p style="margin:20px 0 0;font-size:14px;line-height:1.55;color:#3e4c59;">${escapar(texto)}</p>`;

const boton = (recordId: string) => `
  <p style="margin:24px 0 0;">
    <a href="${link(recordId)}" style="background:#0b3d91;color:#fff;padding:11px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;display:inline-block;">Ver registro</a>
  </p>
  <p style="margin:10px 0 0;font-size:12px;color:#8792a2;word-break:break-all;">Si el botón no funciona, copia esta dirección: ${link(recordId)}</p>`;

const link = (recordId: string) =>
  `${config.appBaseUrl.replace(/\/$/, "")}/registros/${recordId}`;

/** Ficha común a todos los correos: identifica de qué requerimiento se habla. */
const fichaProducto = (record: ConciliationRecord) =>
  ficha(
    dato("Producto", record.producto) +
      dato("Cód. Producto", record.codigoProducto ?? "—") +
      dato("Planta", record.planta) +
      dato("Fecha de conciliación", record.fechaConciliacion.toLocaleDateString("es-PE"))
  );

export function buildNuevoRequerimientoEmail(record: ConciliationRecord) {
  const subject = `Nuevo requerimiento de conciliación: ${record.producto}`;
  const html = wrapper(
    "Nuevo requerimiento asignado a Documentación Técnica",
    `
    ${fichaProducto(record)}
    ${ficha(
      dato(
        "Ruta elegida",
        record.tipoFlujo === "GENERAR_RECETA"
          ? "Generar receta de conciliación"
          : "Actualizar receta sin generar conciliación"
      )
    )}
    ${bloque("Motivo de conciliación", record.motivoConciliacion)}
    ${bloque("Materiales a conciliar", record.materialesAConciliar)}
    ${record.asuntosRegulatorios ? bloque("Asuntos regulatorios", record.asuntosRegulatorios) : ""}
    ${parrafo("Planeamiento registró el requerimiento y espera la revisión de Documentación Técnica.")}
    ${boton(record.id)}`
  );
  return { subject, html };
}

export function buildRechazoTecnicoEmail(record: ConciliationRecord, motivo: string) {
  const subject = `No se pudo generar la receta: ${record.producto}`;
  const html = wrapper(
    "Documentación Técnica no pudo completar este requerimiento",
    `
    ${fichaProducto(record)}
    ${bloque("Motivo indicado por Documentación Técnica", motivo)}
    ${parrafo("Revisa el motivo y decide los siguientes pasos.")}
    ${boton(record.id)}`
  );
  return { subject, html };
}

export function buildDecisionPlaneamientoEmail(record: ConciliationRecord, aprobado: boolean, motivo?: string) {
  const subject = aprobado
    ? `Requerimiento concluido: ${record.producto}`
    : `Requerimiento devuelto para revisión: ${record.producto}`;
  const html = wrapper(
    aprobado ? "Planeamiento concluyó el requerimiento" : "Planeamiento devolvió el requerimiento",
    `
    ${fichaProducto(record)}
    ${!aprobado && motivo ? bloque("Motivo de la devolución", motivo) : ""}
    ${parrafo(
      aprobado
        ? "Planeamiento revisó el trabajo de Documentación Técnica y lo dio por concluido."
        : "Planeamiento revisó el trabajo entregado y solicita ajustes antes de darlo por concluido."
    )}
    ${boton(record.id)}`
  );
  return { subject, html };
}

export function buildRecetaListaEmail(record: ConciliationRecord, observaciones?: string | null) {
  const esGeneracion = record.tipoFlujo === "GENERAR_RECETA";
  const subject = esGeneracion
    ? `Receta de conciliación generada: ${record.producto}`
    : `Receta actualizada (sin conciliación): ${record.producto}`;
  const html = wrapper(
    esGeneracion ? "Receta de conciliación generada" : "Actualización de receta completada",
    `
    ${fichaProducto(record)}
    ${parrafo("Documentación Técnica finalizó su tarea sobre este requerimiento. Ya puedes revisar el detalle.")}
    ${observaciones?.trim() ? bloque("Observaciones de Documentación Técnica", observaciones.trim()) : ""}
    ${boton(record.id)}`
  );
  return { subject, html };
}
