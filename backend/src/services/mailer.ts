import nodemailer from "nodemailer";
import { config } from "../config";

// Transporte SMTP único para toda la app. Por defecto apunta a
// smtp.office365.com (SMTP AUTH de Microsoft 365/Outlook) usando una cuenta
// de servicio, así el envío no depende de que ningún usuario tenga Outlook
// abierto ni configurado en su equipo. Cambiando estas 4 variables de
// entorno (SMTP_HOST/PORT/USER/PASSWORD) se puede usar cualquier otro
// proveedor (SendGrid, Amazon SES, etc.) sin tocar código.
// Timeouts cortos a propósito: en Vercel el envío ocurre dentro de una
// función serverless con presupuesto de tiempo limitado (10s en el plan
// Hobby). Si SMTP no responde rápido, mejor fallar pronto y dejar que el
// Cron Job reintente, que colgar la request del usuario.
export const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure, // true = 465 (SSL), false = 587 (STARTTLS)
  auth: config.smtp.user
    ? { user: config.smtp.user, pass: config.smtp.password }
    : undefined,
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  socketTimeout: 5000,
});

export async function verifyMailer(): Promise<void> {
  await transporter.verify();
}
