import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Falta la variable de entorno requerida: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:5173",

  jwt: {
    secret: required("JWT_SECRET", "dev-secret-cambiar"),
    expiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  },

  smtp: {
    host: process.env.SMTP_HOST ?? "smtp.office365.com",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER ?? "",
    password: process.env.SMTP_PASSWORD ?? "",
    from: process.env.MAIL_FROM ?? "Recetas de Conciliación <no-reply@example.com>",
  },

  emailWorkerIntervalMs: Number(process.env.EMAIL_WORKER_INTERVAL_MS ?? 5000),

  // Secreto que debe traer el Cron Job de Vercel para poder llamar a
  // /api/cron/process-emails. Si no está configurado, el endpoint queda
  // deshabilitado (nunca acepta llamadas anónimas).
  cronSecret: process.env.CRON_SECRET,
};
