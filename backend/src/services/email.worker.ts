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
export async function enviarCorreoInmediato(emailLogId: string): Promise<boolean> {
  const correo = await prisma.emailLog.findUnique({ where: { id: emailLogId } });
  if (!correo) return false;
  if (correo.estado === "ENVIADO") return true;
  return despacharUno(correo);
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

// Reintento adicional en proceso: si el backend corre como servicio
// persistente (no como función serverless efímera), este intervalo reintenta
// correos FALLIDO/PENDIENTE cada pocos segundos, sin esperar al Cron Job
// (que en el plan Hobby de Vercel solo corre 1 vez al día). Es un refuerzo,
// no la única red de seguridad: si el proceso se reinicia o el host no lo
// mantiene vivo, el Cron sigue cubriendo el reintento igual. Nunca debe
// tumbar el proceso: cualquier error (ej. la base de datos momentáneamente
// inalcanzable al arrancar) se atrapa y solo se registra en el log.
export function startEmailWorker(): void {
  const ejecutar = () => {
    procesarLote().catch((err) => {
      console.error("[email.worker] error al procesar el lote de correos:", err);
    });
  };
  ejecutar();
  setInterval(ejecutar, config.emailWorkerIntervalMs);
}
