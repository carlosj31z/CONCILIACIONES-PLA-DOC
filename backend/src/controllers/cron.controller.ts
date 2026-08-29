import type { Request, Response } from "express";
import { procesarLote } from "../services/email.worker";

/**
 * Llamado por el Cron Job de Vercel (ver vercel.json). Reintenta los
 * correos que el envío inline (dentro de los controladores de records) no
 * pudo despachar — SMTP caído, timeout, etc. Es el mecanismo de "reintento
 * asíncrono" en un entorno serverless, donde no existe un proceso en
 * background como el worker de desarrollo local.
 */
export async function procesarCorreosPendientes(_req: Request, res: Response) {
  const resultado = await procesarLote();
  res.json(resultado);
}
