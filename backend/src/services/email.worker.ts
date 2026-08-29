import { prisma } from "../db";
import { transporter } from "./mailer";
import { config } from "../config";

const MAX_INTENTOS = 5;
let running = false;

// Toma correos PENDIENTES (o FALLIDOS con margen de reintento) de la tabla
// EmailLog y los despacha por SMTP. Se ejecuta en un intervalo separado del
// ciclo de request/response de la API: si SMTP está lento o cae, el usuario
// que guardó el registro nunca lo nota.
async function procesarPendientes(): Promise<void> {
  if (running) return; // evita solapar corridas si una tanda tarda más que el intervalo
  running = true;
  try {
    const pendientes = await prisma.emailLog.findMany({
      where: { estado: { in: ["PENDIENTE", "FALLIDO"] }, intentos: { lt: MAX_INTENTOS } },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    for (const correo of pendientes) {
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
      } catch (err) {
        const mensaje = err instanceof Error ? err.message : "Error desconocido al enviar correo";
        await prisma.emailLog.update({
          where: { id: correo.id },
          data: { estado: "FALLIDO", ultimoError: mensaje, intentos: { increment: 1 } },
        });
        console.error(`[email.worker] fallo enviando correo ${correo.id}:`, mensaje);
      }
    }
  } finally {
    running = false;
  }
}

export function startEmailWorker(): void {
  procesarPendientes();
  setInterval(procesarPendientes, config.emailWorkerIntervalMs);
}
