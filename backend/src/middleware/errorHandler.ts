import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Datos inválidos",
      detalles: err.issues.map((i) => ({ campo: i.path.join("."), mensaje: i.message })),
    });
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }

  /*
    Cuerpo más grande que el límite del parser. Lo lanza express antes de que
    corra el controlador, así que la validación de tamaño de allí nunca llega
    a ejecutarse: sin este caso, subir un archivo demasiado pesado devolvía
    "Error interno del servidor", que no le dice al usuario qué hacer.
  */
  if (typeof err === "object" && err !== null && (err as { type?: string }).type === "entity.too.large") {
    return res.status(413).json({ error: "El archivo es demasiado grande. El máximo permitido es 4 MB." });
  }

  console.error(err);
  return res.status(500).json({ error: "Error interno del servidor" });
}
