import type { EmailLog } from "@prisma/client";
import { prisma } from "../db";
import { transporter } from "./mailer";
import { config } from "../config";

const MAX_INTENTOS = 5;

async function despacharUno(correo: EmailLog): Promise<boolean> {
  const destinatarios: string[] = JSON.parse(correo.destinatarios);
  try {
    await transporter.sendMail({
      from: config.smtp.from,
      to: destinatarios,
      subject: correo.asunto,
      html: correo.cuerpoHtml,
    });

    await prisma.emailLog.update({
      where: { id: correo.id },
      data: { estado: "ENVIADO", enviadoAt: new Date(), intentos: { increment: 1 } },
    });
    return true;
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "Error desconocido al enviar correo";
    await prisma.emailLog.update({
      where: { id: correo.id },
      data: { estado: "FALLIDO", ultimoError: mensaje, intentos: { increment: 1 } },
    });
    console.error(`[email.worker] fallo enviando correo ${correo.id}:`, mensaje);
    return false;
  }
}

/**
 * Envía UN correo puntual, inmediatamente después de encolarlo (patrón
 * "envío inline"). Se usa en producción (Vercel): el controlador que cambia
 * el estado llama a esta función justo después de confirmar la transacción,
 * así el usuario ve el resultado real en la misma respuesta. Nunca lanza:
 * si SMTP falla, el correo queda en estado FALLIDO para que lo recoja el
 * Cron Job de reintento (`procesarLote`, vía /api/cron/process-emails).
 */
export async function enviarCorreoInmediato(emailLogId: string): Promise<void> {
  const correo = await prisma.emailLog.findUnique({ where: { id: emailLogId } });
  if (!correo || correo.estado === "ENVIADO") return;
  await despacharUno(correo);
}

/**
 * Procesa en lote los correos PENDIENTE/FALLIDO con reintentos disponibles.
 * Dos usuarios:
 *  - El Cron Job de Vercel (`/api/cron/process-emails`), que reintenta lo
 *    que el envío inline no pudo despachar.
 *  - El worker de desarrollo local (`npm run dev`, ver `startEmailWorker`),
 *    que emula ese mismo Cron con un `setInterval` mientras se prueba en la
 *    máquina del desarrollador.
 */
export async function procesarLote(limit = 20): Promise<{ procesados: number; enviados: number }> {
  const pendientes = await prisma.emailLog.findMany({
    where: { estado: { in: ["PENDIENTE", "FALLIDO"] }, intentos: { lt: MAX_INTENTOS } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let enviados = 0;
  for (const correo of pendientes) {
    if (await despacharUno(correo)) enviados++;
  }
  return { procesados: pendientes.length, enviados };
}

// Solo para desarrollo local: emula el Cron de Vercel con un intervalo en
// proceso. No se usa en producción (allí no hay proceso persistente).
export function startEmailWorker(): void {
  procesarLote();
  setInterval(() => void procesarLote(), config.emailWorkerIntervalMs);
}
