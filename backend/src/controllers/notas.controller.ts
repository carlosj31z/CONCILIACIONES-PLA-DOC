import type { Request, Response } from "express";
import { prisma } from "../db";
import { HttpError } from "../middleware/errorHandler";
import {
  TAMANO_MAXIMO_BYTES,
  TIPOS_PERMITIDOS,
  borrarAdjunto,
  enlaceTemporal,
  rutaDeAdjunto,
  subirAdjunto,
} from "../services/storage.service";
import { actualizarNotaSchema, crearNotaSchema } from "../utils/validators";

const SELECT_NOTA = {
  id: true,
  contenido: true,
  visibilidad: true,
  createdAt: true,
  updatedAt: true,
  autorId: true,
  autor: { select: { nombre: true } },
  adjuntos: {
    select: { id: true, nombre: true, tipo: true, tamano: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  },
} as const;

/**
 * Una nota es de quien la escribió: solo esa persona puede editarla,
 * borrarla o tocar sus archivos. Ni siquiera un ADMIN, porque una nota
 * privada es justamente eso — y una compartida sigue siendo su opinión
 * firmada, que otro no debería poder reescribir.
 */
async function exigirAutoria(notaId: string, userId: string) {
  const nota = await prisma.recordNota.findUnique({
    where: { id: notaId },
    select: { id: true, autorId: true, recordId: true },
  });
  if (!nota) throw new HttpError(404, "Nota no encontrada");
  if (nota.autorId !== userId) {
    throw new HttpError(403, "Solo quien escribió la nota puede modificarla");
  }
  return nota;
}

/** Las compartidas las ve cualquiera; las privadas, solo su autor. */
export async function listarNotas(req: Request, res: Response) {
  const { id: recordId } = req.params;
  const userId = req.user!.id;

  const registro = await prisma.conciliationRecord.findUnique({ where: { id: recordId }, select: { id: true } });
  if (!registro) throw new HttpError(404, "Registro no encontrado");

  const notas = await prisma.recordNota.findMany({
    where: {
      recordId,
      OR: [{ visibilidad: "COMPARTIDA" }, { autorId: userId }],
    },
    select: SELECT_NOTA,
    orderBy: { createdAt: "desc" },
  });

  res.json(notas.map((n) => ({ ...n, esMia: n.autorId === userId })));
}

export async function crearNota(req: Request, res: Response) {
  const { id: recordId } = req.params;
  const userId = req.user!.id;
  const data = crearNotaSchema.parse(req.body);

  const registro = await prisma.conciliationRecord.findUnique({ where: { id: recordId }, select: { id: true } });
  if (!registro) throw new HttpError(404, "Registro no encontrado");

  const nota = await prisma.recordNota.create({
    data: { recordId, autorId: userId, contenido: data.contenido, visibilidad: data.visibilidad },
    select: SELECT_NOTA,
  });

  res.status(201).json({ ...nota, esMia: true });
}

export async function actualizarNota(req: Request, res: Response) {
  const { notaId } = req.params;
  await exigirAutoria(notaId, req.user!.id);
  const data = actualizarNotaSchema.parse(req.body);

  const nota = await prisma.recordNota.update({ where: { id: notaId }, data, select: SELECT_NOTA });
  res.json({ ...nota, esMia: true });
}

export async function eliminarNota(req: Request, res: Response) {
  const { notaId } = req.params;
  await exigirAutoria(notaId, req.user!.id);

  // Los archivos se borran del bucket antes que la fila: si se borrara
  // primero la nota, se perdería la ruta y quedarían huérfanos para siempre.
  const adjuntos = await prisma.notaAdjunto.findMany({ where: { notaId }, select: { ruta: true } });
  await Promise.all(adjuntos.map((a) => borrarAdjunto(a.ruta)));

  await prisma.recordNota.delete({ where: { id: notaId } });
  res.status(204).end();
}

/**
 * Sube un archivo a una nota. El cuerpo es el archivo en crudo y el nombre y
 * el tipo viajan en la query: así no hace falta una librería de multipart
 * para un caso de un solo archivo por petición.
 */
export async function agregarAdjunto(req: Request, res: Response) {
  const { notaId } = req.params;
  await exigirAutoria(notaId, req.user!.id);

  const nombre = String(req.query.nombre ?? "").trim().slice(0, 200);
  const tipo = String(req.query.tipo ?? "").trim();
  if (!nombre) throw new HttpError(400, "Falta el nombre del archivo");
  if (!TIPOS_PERMITIDOS.includes(tipo)) {
    throw new HttpError(415, `Tipo de archivo no admitido: ${tipo || "desconocido"}`);
  }

  const contenido = req.body as Buffer;
  if (!Buffer.isBuffer(contenido) || contenido.length === 0) {
    throw new HttpError(400, "El archivo llegó vacío");
  }
  if (contenido.length > TAMANO_MAXIMO_BYTES) {
    throw new HttpError(413, `El archivo supera el máximo de ${Math.round(TAMANO_MAXIMO_BYTES / 1024 / 1024)} MB`);
  }

  const ruta = rutaDeAdjunto(notaId, nombre);
  await subirAdjunto(ruta, contenido, tipo);

  const adjunto = await prisma.notaAdjunto.create({
    data: { notaId, nombre, tipo, tamano: contenido.length, ruta },
    select: { id: true, nombre: true, tipo: true, tamano: true, createdAt: true },
  });

  res.status(201).json(adjunto);
}

export async function eliminarAdjunto(req: Request, res: Response) {
  const { notaId, adjuntoId } = req.params;
  await exigirAutoria(notaId, req.user!.id);

  const adjunto = await prisma.notaAdjunto.findUnique({ where: { id: adjuntoId } });
  if (!adjunto || adjunto.notaId !== notaId) throw new HttpError(404, "Adjunto no encontrado en esta nota");

  await borrarAdjunto(adjunto.ruta);
  await prisma.notaAdjunto.delete({ where: { id: adjuntoId } });
  res.status(204).end();
}

/**
 * Enlace temporal para ver o descargar un adjunto. Puede pedirlo cualquiera
 * que tenga permiso de leer la nota: su autor siempre, y el resto solo si la
 * nota es compartida.
 */
export async function enlaceAdjunto(req: Request, res: Response) {
  const { notaId, adjuntoId } = req.params;
  const userId = req.user!.id;

  const nota = await prisma.recordNota.findUnique({
    where: { id: notaId },
    select: { autorId: true, visibilidad: true },
  });
  if (!nota) throw new HttpError(404, "Nota no encontrada");
  if (nota.visibilidad === "PRIVADA" && nota.autorId !== userId) {
    throw new HttpError(403, "Esta nota es privada");
  }

  const adjunto = await prisma.notaAdjunto.findUnique({ where: { id: adjuntoId } });
  if (!adjunto || adjunto.notaId !== notaId) throw new HttpError(404, "Adjunto no encontrado en esta nota");

  res.json({ url: await enlaceTemporal(adjunto.ruta), nombre: adjunto.nombre, tipo: adjunto.tipo });
}
