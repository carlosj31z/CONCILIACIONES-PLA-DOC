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
                <span style="color:#ffffff;font-size:16px;font-weight:600;">Recetas de Conciliación</span>
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
                <span style="font-size:12px;color:#8792a2;">Correo automático, no responder. Generado por el sistema de Recetas de Conciliación.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const row = (label: string, value: string) =>
  `<p style="margin:0 0 8px;font-size:14px;"><strong>${label}:</strong> ${value}</p>`;

const link = (recordId: string) =>
  `${config.appBaseUrl.replace(/\/$/, "")}/registros/${recordId}`;

export function buildNuevoRequerimientoEmail(record: ConciliationRecord) {
  const subject = `Nuevo requerimiento de conciliación: ${record.producto}`;
  const html = wrapper(
    "Nuevo requerimiento asignado a Documentación Técnica",
    `
    ${row("Producto", record.producto)}
    ${row("Cód. Producto", record.codigoProducto ?? "—")}
    ${row("Planta", record.planta)}
    ${row("Fecha de conciliación", record.fechaConciliacion.toLocaleDateString("es-PE"))}
    ${row("Materiales a conciliar", record.materialesAConciliar)}
    ${record.asuntosRegulatorios ? row("Asuntos regulatorios", record.asuntosRegulatorios) : ""}
    ${row("Ruta elegida", record.tipoFlujo === "GENERAR_RECETA" ? "Generar receta de conciliación" : "Actualizar receta sin generar conciliación")}
    <p style="margin:16px 0 0;font-size:14px;">Planeamiento registró el motivo de conciliación y espera la revisión de Documentación Técnica.</p>
    <p style="margin:20px 0 0;">
      <a href="${link(record.id)}" style="background:#0b3d91;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:14px;">Ver registro</a>
    </p>`
  );
  return { subject, html };
}

export function buildRecetaListaEmail(record: ConciliationRecord) {
  const esGeneracion = record.tipoFlujo === "GENERAR_RECETA";
  const subject = esGeneracion
    ? `Receta de conciliación generada: ${record.producto}`
    : `Receta actualizada (sin conciliación): ${record.producto}`;
  const html = wrapper(
    esGeneracion ? "Receta de conciliación generada" : "Actualización de receta completada",
    `
    ${row("Producto", record.producto)}
    ${row("Cód. Producto", record.codigoProducto ?? "—")}
    ${row("Planta", record.planta)}
    <p style="margin:16px 0 0;font-size:14px;">Documentación Técnica finalizó su tarea sobre este requerimiento. Ya puedes revisar el detalle.</p>
    <p style="margin:20px 0 0;">
      <a href="${link(record.id)}" style="background:#0b3d91;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:14px;">Ver registro</a>
    </p>`
  );
  return { subject, html };
}
