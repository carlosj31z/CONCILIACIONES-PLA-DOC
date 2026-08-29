import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "../types/enums";
import { config } from "../config";
import { HttpError } from "./errorHandler";
import type { AuthUser } from "../types";

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new HttpError(401, "No autenticado");
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, config.jwt.secret) as AuthUser;
    req.user = payload;
    next();
  } catch {
    throw new HttpError(401, "Sesión inválida o expirada");
  }
}

// Restringe una ruta a uno o más roles (ej. requireRole("PLANEAMIENTO")).
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new HttpError(401, "No autenticado");
    if (!roles.includes(req.user.role)) {
      throw new HttpError(403, "No tienes permiso para realizar esta acción");
    }
    next();
  };
}
