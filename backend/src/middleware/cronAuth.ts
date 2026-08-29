import type { NextFunction, Request, Response } from "express";
import { config } from "../config";
import { HttpError } from "./errorHandler";

// Vercel Cron agrega automáticamente `Authorization: Bearer <CRON_SECRET>`
// a cada invocación programada cuando la variable de entorno CRON_SECRET
// está configurada en el proyecto. Cualquier otra request (sin el secreto
// correcto) se rechaza, para que este endpoint no quede abierto al público.
export function requireCronSecret(req: Request, _res: Response, next: NextFunction) {
  if (!config.cronSecret) {
    throw new HttpError(500, "CRON_SECRET no está configurado en el servidor");
  }
  const header = req.headers.authorization;
  if (header !== `Bearer ${config.cronSecret}`) {
    throw new HttpError(401, "No autorizado");
  }
  next();
}
