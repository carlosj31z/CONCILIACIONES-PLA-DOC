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

/**
 * Directorio liviano para cualquier usuario autenticado (no solo ADMIN): lo
 * usa el frontend para prellenar los destinatarios de notificación con todo
 * el equipo de Planeamiento y de Documentación Técnica (y los ADMIN, para
 * que queden siempre en copia por defecto), sin exponer datos de
 * administración de cuentas (activo/createdAt).
 */
export async function directorioUsuarios(_req: Request, res: Response) {
  const usuarios = await prisma.user.findMany({
    where: { activo: true, role: { in: ["PLANEAMIENTO", "DOC_TECNICA", "ADMIN"] } },
    select: { id: true, nombre: true, email: true, role: true },
    orderBy: { nombre: "asc" },
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

export async function eliminarUsuario(req: Request, res: Response) {
  const { id } = req.params;

  if (id === req.user!.id) {
    throw new HttpError(400, "No puedes eliminar tu propia cuenta");
  }

  const existente = await prisma.user.findUnique({ where: { id } });
  if (!existente) throw new HttpError(404, "Usuario no encontrado");

  try {
    await prisma.user.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    // P2003: violación de llave foránea — el usuario creó requerimientos o
    // tiene historial asociado, que no se puede borrar en cascada sin
    // perder trazabilidad. Se le pide desactivar en su lugar.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      throw new HttpError(
        409,
        "No se puede eliminar: el usuario tiene requerimientos o historial asociado. Desactívalo en su lugar.",
      );
    }
    throw err;
  }
}
