import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { HttpError } from "../middleware/errorHandler";
import { actualizarUsuarioSchema, crearUsuarioSchema } from "../utils/validators";

const SELECT_PUBLICO = {
  id: true,
  nombre: true,
  email: true,
  role: true,
  puesto: true,
  activo: true,
  createdAt: true,
} as const;

export async function listarUsuarios(_req: Request, res: Response) {
  const usuarios = await prisma.user.findMany({
    select: SELECT_PUBLICO,
    orderBy: { createdAt: "asc" },
  });
  res.json(usuarios);
}

export async function crearUsuario(req: Request, res: Response) {
  const data = crearUsuarioSchema.parse(req.body);

  try {
    const usuario = await prisma.user.create({
      data: { nombre: data.nombre, email: data.email.toLowerCase(), role: data.role, puesto: data.puesto },
      select: SELECT_PUBLICO,
    });
    res.status(201).json(usuario);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new HttpError(409, "Ya existe un usuario con ese correo");
    }
    throw err;
  }
}

export async function actualizarUsuario(req: Request, res: Response) {
  const { id } = req.params;
  const data = actualizarUsuarioSchema.parse(req.body);

  if (id === req.user!.id && data.activo === false) {
    throw new HttpError(400, "No puedes desactivar tu propia cuenta");
  }

  const existente = await prisma.user.findUnique({ where: { id } });
  if (!existente) throw new HttpError(404, "Usuario no encontrado");

  const usuario = await prisma.user.update({
    where: { id },
    data,
    select: SELECT_PUBLICO,
  });
  res.json(usuario);
}
