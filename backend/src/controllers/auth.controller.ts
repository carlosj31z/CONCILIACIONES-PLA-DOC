import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../db";
import { config } from "../config";
import { HttpError } from "../middleware/errorHandler";
import { loginSchema } from "../utils/validators";
import type { AuthUser } from "../types";

// Acceso solo con correo: no hay contraseña que validar. La cuenta debe
// existir y estar activa (el alta la hace un ADMIN desde /usuarios).
export async function login(req: Request, res: Response) {
  const { email } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.activo) throw new HttpError(401, "No existe una cuenta activa con ese correo");

  const payload: AuthUser = { id: user.id, email: user.email, nombre: user.nombre, role: user.role, puesto: user.puesto };
  const token = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn } as jwt.SignOptions);

  res.json({ token, user: payload });
}

export async function me(req: Request, res: Response) {
  res.json({ user: req.user });
}
