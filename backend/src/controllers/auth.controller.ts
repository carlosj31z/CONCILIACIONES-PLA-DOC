import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../db";
import { config } from "../config";
import { HttpError } from "../middleware/errorHandler";
import { loginSchema } from "../utils/validators";
import type { AuthUser } from "../types";

export async function login(req: Request, res: Response) {
  const { email, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.activo) throw new HttpError(401, "Credenciales inválidas");

  const valido = await bcrypt.compare(password, user.passwordHash);
  if (!valido) throw new HttpError(401, "Credenciales inválidas");

  const payload: AuthUser = { id: user.id, email: user.email, nombre: user.nombre, role: user.role };
  const token = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn } as jwt.SignOptions);

  res.json({ token, user: payload });
}

export async function me(req: Request, res: Response) {
  res.json({ user: req.user });
}
