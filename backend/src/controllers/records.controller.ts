import type { Request, Response } from "express";
import { prisma } from "../db";
import { HttpError } from "../middleware/errorHandler";
import { encolarCorreo, normalizarDestinatarios } from "../services/email.service";
import {
  actualizarTecnicaSchema,
  completarTecnicaSchema,
  crearRegistroSchema,
  decisionSchema,
} from "../utils/validators";

/**
 * Rol Planeamiento: crea el registro con los datos base del requerimiento.
 * Estado inicial: PENDIENTE_PLANEAMIENTO (aún no se eligió ruta ni se notificó
 * a nadie). No dispara correo todavía: el trigger 1 ocurre en `decidirRuta`.
 */
export async function crearRegistro(req: Request, res: Response) {
  const data = crearRegistroSchema.parse(req.body);
  const userId = req.user!.id;

  const record = await prisma.$transaction(async (tx) => {
    const nuevo = await tx.conciliationRecord.create({
      data: {
        codigoProducto: data.codigoProducto || null,
        producto: data.producto,
        planta: data.planta,
        fechaConciliacion: data.fechaConciliacion,
        motivoConciliacion: data.motivoConciliacion,
        creadoPorId: userId,
        lotes: { create: data.lotes.map((numeroLote) => ({ numeroLote })) },
      },
    });

    await tx.statusHistory.create({
      data: {
        recordId: nuevo.id,
        estadoDesde: null,
        estadoHasta: "PENDIENTE_PLANEAMIENTO",
        cambiadoPorId: userId,
      },
    });

    return nuevo;
  });

  res.status(201).json(record);
}

/**
 * Rol Planeamiento — CONTROLADOR CLAVE (deliverable #3).
 *
 * Procesa la "Decisión de Flujo": Planeamiento elige entre "Generar receta de
 * conciliación" o "Actualizar receta sin generar conciliación", ingresa los
 * correos destino en el campo de etiquetas del frontend, y al guardar:
 *   1. Cambia el estado del registro a EN_REVISION_TECNICA.
 *   2. Registra el cambio en el historial de auditoría.
 *   3. Encola (no envía en línea) el correo de "nuevo requerimiento" para
 *      los destinatarios recibidos desde el frontend.
 * El envío real lo hace el worker asíncrono (services/email.worker.ts), así
 * que esta request responde de inmediato sin esperar a SMTP.
 */
export async function decidirRuta(req: Request, res: Response) {
  const { id } = req.params;
  const { tipoFlujo, destinatarios } = decisionSchema.parse(req.body);
  const userId = req.user!.id;

  const existente = await prisma.conciliationRecord.findUnique({ where: { id } });
  if (!existente) throw new HttpError(404, "Registro no encontrado");
  if (existente.estado !== "PENDIENTE_PLANEAMIENTO") {
    throw new HttpError(409, "Este registro ya fue enviado a revisión técnica");
  }

  const emails = normalizarDestinatarios(destinatarios);

  const record = await prisma.$transaction(async (tx) => {
    const actualizado = await tx.conciliationRecord.update({
      where: { id },
      data: { tipoFlujo, estado: "EN_REVISION_TECNICA" },
    });

    await tx.statusHistory.create({
      data: {
        recordId: id,
        estadoDesde: "PENDIENTE_PLANEAMIENTO",
        estadoHasta: "EN_REVISION_TECNICA",
        cambiadoPorId: userId,
      },
    });

    await encolarCorreo({
      record: actualizado,
      trigger: "NUEVO_REQUERIMIENTO",
      destinatarios: emails,
      tx,
    });

    return actualizado;
  });

  res.json(record);
}

/**
 * Rol Documentación Técnica: guarda variantes/ejecución/observaciones sin
 * cerrar la tarea (autosave / borrador mientras trabaja el registro).
 */
export async function actualizarRespuestaTecnica(req: Request, res: Response) {
  const { id } = req.params;
  const data = actualizarTecnicaSchema.parse(req.body);

  const record = await prisma.conciliationRecord.findUnique({ where: { id } });
  if (!record) throw new HttpError(404, "Registro no encontrado");
  if (record.estado !== "EN_REVISION_TECNICA") {
    throw new HttpError(409, "El registro no está en revisión técnica");
  }

  const respuesta = await prisma.technicalResponse.upsert({
    where: { recordId: id },
    create: { recordId: id, ...data },
    update: data,
  });

  res.json(respuesta);
}

/**
 * Rol Documentación Técnica — mismo patrón que `decidirRuta`: al marcar la
 * tarea como completada, ingresa los correos de los interesados y el sistema
 * cambia el estado final (RECETA_GENERADA o ACTUALIZACION_COMPLETADA según
 * la ruta que eligió Planeamiento) y encola el correo de confirmación
 * (Trigger 2).
 */
export async function completarTarea(req: Request, res: Response) {
  const { id } = req.params;
  const { destinatarios, ...campos } = completarTecnicaSchema.parse(req.body);
  const userId = req.user!.id;

  const existente = await prisma.conciliationRecord.findUnique({ where: { id } });
  if (!existente) throw new HttpError(404, "Registro no encontrado");
  if (existente.estado !== "EN_REVISION_TECNICA") {
    throw new HttpError(409, "El registro no está en revisión técnica");
  }
  if (!existente.tipoFlujo) throw new HttpError(409, "El registro no tiene una ruta definida");

  const emails = normalizarDestinatarios(destinatarios);
  const estadoFinal = existente.tipoFlujo === "GENERAR_RECETA" ? "RECETA_GENERADA" : "ACTUALIZACION_COMPLETADA";

  const record = await prisma.$transaction(async (tx) => {
    await tx.technicalResponse.upsert({
      where: { recordId: id },
      create: { recordId: id, ...campos, completadoPorId: userId, completadoAt: new Date() },
      update: { ...campos, completadoPorId: userId, completadoAt: new Date() },
    });

    const actualizado = await tx.conciliationRecord.update({
      where: { id },
      data: { estado: estadoFinal },
    });

    await tx.statusHistory.create({
      data: {
        recordId: id,
        estadoDesde: "EN_REVISION_TECNICA",
        estadoHasta: estadoFinal,
        cambiadoPorId: userId,
      },
    });

    await encolarCorreo({
      record: actualizado,
      trigger: "RECETA_LISTA",
      destinatarios: emails,
      tx,
    });

    return actualizado;
  });

  res.json(record);
}

export async function listarRegistros(req: Request, res: Response) {
  const { estado, planta, q } = req.query as Record<string, string | undefined>;

  const registros = await prisma.conciliationRecord.findMany({
    where: {
      estado: estado || undefined,
      planta: planta || undefined,
      producto: q ? { contains: q } : undefined,
    },
    orderBy: { createdAt: "desc" },
    include: { creadoPor: { select: { nombre: true } }, respuestaTecnica: true },
  });

  res.json(registros);
}

export async function obtenerRegistro(req: Request, res: Response) {
  const { id } = req.params;
  const registro = await prisma.conciliationRecord.findUnique({
    where: { id },
    include: {
      creadoPor: { select: { nombre: true, email: true } },
      lotes: true,
      respuestaTecnica: { include: { completadoPor: { select: { nombre: true } } } },
      destinatarios: true,
      historial: { orderBy: { createdAt: "asc" }, include: { cambiadoPor: { select: { nombre: true } } } },
    },
  });
  if (!registro) throw new HttpError(404, "Registro no encontrado");
  res.json(registro);
}
