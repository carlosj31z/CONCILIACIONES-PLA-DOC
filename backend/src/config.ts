import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Falta la variable de entorno requerida: ${name}`);
  }
  return value;
}

/**
 * Dirección pública de la app, la que se usa para armar el enlace "Ver
 * registro" de los correos.
 *
 * Si APP_BASE_URL no está configurada se deducía localhost, y en producción
 * eso dejaba los correos con un enlace que solo funciona en la computadora
 * de quien desarrolla. Vercel publica el dominio del proyecto en sus propias
 * variables, así que se usan como respaldo: primero el de producción y, en
 * un despliegue de vista previa, el de ese despliegue.
 */
function urlPublicaPorDefecto(): string {
  const produccion = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (produccion) return `https://${produccion}`;
  const despliegue = process.env.VERCEL_URL;
  if (despliegue) return `https://${despliegue}`;
  return "http://localhost:5173";
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  appBaseUrl: process.env.APP_BASE_URL ?? urlPublicaPorDefecto(),

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
    from: process.env.MAIL_FROM ?? "Conciliaciones <no-reply@example.com>",
  },

  emailWorkerIntervalMs: Number(process.env.EMAIL_WORKER_INTERVAL_MS ?? 5000),

  // Supabase Storage, donde viven los archivos adjuntos de las notas. Es el
  // mismo proyecto de Supabase que la base de datos, pero se configura
  // aparte porque necesita la URL del proyecto y la clave de servicio, no la
  // cadena de conexión de Postgres. Sin esto la app funciona igual: solo se
  // deshabilitan los adjuntos, con un mensaje que lo explica.
  storage: {
    url: process.env.SUPABASE_URL ?? "",
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    bucket: process.env.SUPABASE_STORAGE_BUCKET ?? "notas-adjuntos",
  },

  // Secreto que debe traer el Cron Job de Vercel para poder llamar a
  // /api/cron/process-emails. Si no está configurado, el endpoint queda
  // deshabilitado (nunca acepta llamadas anónimas).
  cronSecret: process.env.CRON_SECRET,

  // Proyecto de Supabase (independiente del de esta app) donde vive el
  // Maestro de Materiales de SAP MM & LM ("mm_materiales"). Se consulta en
  // modo solo-lectura para que Planeamiento pueda buscar código/nombre de
  // producto real de SAP en vez de escribirlos a mano. La URL y la
  // "publishable key" por defecto son las mismas que ya usa esa herramienta
  // (una publishable key está pensada para ser pública, protegida por RLS
  // del lado de Supabase); quedan overrideables por variable de entorno por
  // si algún día cambian.
  sapMaestro: {
    url: process.env.SAP_MAESTRO_SUPABASE_URL ?? "https://wjlryrqkcnvjlrdibzol.supabase.co",
    anonKey: process.env.SAP_MAESTRO_SUPABASE_ANON_KEY ?? "sb_publishable_2Qm4zOkdHeSMOYvatAyNiA_K5crlvFc",
  },
};
