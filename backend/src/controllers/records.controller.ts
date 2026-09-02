import type { Request, Response } from "express";
import { EstadoRegistro } from "@prisma/client";
import { prisma } from "../db";
import { HttpError } from "../middleware/errorHandler";
import { encolarCorreo, normalizarDestinatarios } from "../services/email.service";
import { enviarCorreoInmediato } from "../services/email.worker";
import { borrarAdjunto } from "../services/storage.service";
import {
  actualizarRegistroSchema,
  actualizarTecnicaSchema,
  completarTecnicaSchema,
  crearRegistroSchema,
  decisionSchema,
  listaConciliarSchema,
  rechazarPlaneamientoSchema,
  rechazarTecnicaSchema,
} from "../utils/validators";

const ESTADOS_EDITABLES = ["PENDIENTE_PLANEAMIENTO", "EN_REVISION_TECNICA"] as const;
const ESTADOS_ELIMINABLES = [
  "PENDIENTE_PLANEAMIENTO",
  "EN_REVISION_TECNICA",
  "RECHAZADA_TECNICA",
  "ENTREGADA",
] as const;
const ESTADOS_PENDIENTES_DECISION = ["ENTREGADA"] as const;

/** Mismo criterio de "puede editar" que usa `actualizarRegistro`: dueño (o ADMIN) y estado aún en curso. */
function verificarPuedeEditar(
  existente: { creadoPorId: string; estado: string },
  userId: string,
  role: string
) {
  if (existente.creadoPorId !== userId && role !== "ADMIN") {
    throw new HttpError(403, "Solo quien creó el requerimiento puede editarlo");
  }
  if (!ESTADOS_EDITABLES.includes(existente.estado as (typeof ESTADOS_EDITABLES)[number])) {
    throw new HttpError(409, "Este registro ya fue cerrado y no se puede editar");
  }
}

async function destinatariosOriginales(recordId: string): Promise<string[]> {
  const filas = await prisma.emailRecipient.findMany({
    where: { recordId, trigger: "NUEVO_REQUERIMIENTO" },
    select: { email: true },
  });
  return Array.from(new Set(filas.map((f) => f.email)));
}

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
        materialesAConciliar: data.materialesAConciliar,
        asuntosRegulatorios: data.asuntosRegulatorios || null,
        creadoPorId: userId,
        listasConciliar: { create: data.listasConciliar },
      },
      include: { listasConciliar: true },
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
 *   3. Encola el correo de "nuevo requerimiento" para los destinatarios
 *      recibidos desde el frontend, dentro de la misma transacción.
 * Confirmada la transacción, se intenta el envío inline (best-effort): si
 * SMTP falla no se revierte nada ni se corta la respuesta — el correo queda
 * en estado FALLIDO y lo recoge el Cron Job de reintento.
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

  const { record, emailLogId } = await prisma.$transaction(async (tx) => {
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

    const emailLog = await encolarCorreo({
      record: actualizado,
      trigger: "NUEVO_REQUERIMIENTO",
      destinatarios: emails,
      tx,
    });

    return { record: actualizado, emailLogId: emailLog.id };
  });

  const enviado = await enviarCorreoInmediato(emailLogId);

  res.json({ ...record, emailEstado: enviado ? "ENVIADO" : "FALLIDO" });
}

/**
 * Rol Planeamiento (dueño del registro) o ADMIN: corrige los datos base
 * mientras el requerimiento sigue en curso (aún no se cerró con una receta
 * generada o una actualización completada). Deja rastro en el historial.
 */
export async function actualizarRegistro(req: Request, res: Response) {
  const { id } = req.params;
  const data = actualizarRegistroSchema.parse(req.body);
  const userId = req.user!.id;

  const existente = await prisma.conciliationRecord.findUnique({ where: { id } });
  if (!existente) throw new HttpError(404, "Registro no encontrado");
  verificarPuedeEditar(existente, userId, req.user!.role);

  const record = await prisma.$transaction(async (tx) => {
    const actualizado = await tx.conciliationRecord.update({
      where: { id },
      data: {
        ...data,
        codigoProducto: data.codigoProducto !== undefined ? data.codigoProducto || null : undefined,
        asuntosRegulatorios: data.asuntosRegulatorios !== undefined ? data.asuntosRegulatorios || null : undefined,
      },
    });

    await tx.statusHistory.create({
      data: {
        recordId: id,
        estadoDesde: existente.estado,
        estadoHasta: existente.estado,
        comentario: "Datos del requerimiento editados por Planeamiento",
        cambiadoPorId: userId,
      },
    });

    return actualizado;
  });

  res.json(record);
}

/**
 * Rol Planeamiento (dueño) o ADMIN: agrega una lista de materiales a la
 * sección "Recetas a conciliar" de un registro ya creado (elegida buscando
 * en SAP, o escrita a mano).
 */
export async function agregarListaConciliar(req: Request, res: Response) {
  const { id } = req.params;
  const data = listaConciliarSchema.parse(req.body);
  const userId = req.user!.id;

  const existente = await prisma.conciliationRecord.findUnique({ where: { id } });
  if (!existente) throw new HttpError(404, "Registro no encontrado");
  verificarPuedeEditar(existente, userId, req.user!.role);

  const lista = await prisma.recordListaConciliar.create({ data: { recordId: id, ...data } });
  res.status(201).json(lista);
}

/**
 * Rol Planeamiento (dueño) o ADMIN: quita una lista de materiales de la
 * sección "Recetas a conciliar" de un registro ya creado.
 */
export async function eliminarListaConciliar(req: Request, res: Response) {
  const { id, listaId } = req.params;
  const userId = req.user!.id;

  const existente = await prisma.conciliationRecord.findUnique({ where: { id } });
  if (!existente) throw new HttpError(404, "Registro no encontrado");
  verificarPuedeEditar(existente, userId, req.user!.role);

  const lista = await prisma.recordListaConciliar.findUnique({ where: { id: listaId } });
  if (!lista || lista.recordId !== id) throw new HttpError(404, "Lista no encontrada en este registro");

  await prisma.recordListaConciliar.delete({ where: { id: listaId } });
  res.status(204).end();
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
 * cambia el estado a ENTREGADA (la ruta que eligió Planeamiento ya vive en
 * tipoFlujo, no hace falta un estado por cada ruta) y encola el correo de
 * confirmación (Trigger 2).
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
  const estadoFinal = "ENTREGADA";

  const { record, emailLogId } = await prisma.$transaction(async (tx) => {
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

    const emailLog = await encolarCorreo({
      record: actualizado,
      trigger: "RECETA_LISTA",
      destinatarios: emails,
      observaciones: campos.observaciones,
      tx,
    });

    return { record: actualizado, emailLogId: emailLog.id };
  });

  const enviado = await enviarCorreoInmediato(emailLogId);

  res.json({ ...record, emailEstado: enviado ? "ENVIADO" : "FALLIDO" });
}

/**
 * Rol Documentación Técnica: en vez de completar la tarea, indica que no fue
 * posible generar la receta (o la actualización) y por qué. Cierra el
 * registro en RECHAZADA_TECNICA y avisa a quien lo creó.
 */
export async function rechazarTecnica(req: Request, res: Response) {
  const { id } = req.params;
  const { motivo } = rechazarTecnicaSchema.parse(req.body);
  const userId = req.user!.id;

  const existente = await prisma.conciliationRecord.findUnique({
    where: { id },
    include: { creadoPor: { select: { email: true } } },
  });
  if (!existente) throw new HttpError(404, "Registro no encontrado");
  if (existente.estado !== "EN_REVISION_TECNICA") {
    throw new HttpError(409, "El registro no está en revisión técnica");
  }

  const { record, emailLogId } = await prisma.$transaction(async (tx) => {
    await tx.technicalResponse.upsert({
      where: { recordId: id },
      create: { recordId: id, motivoRechazo: motivo, completadoPorId: userId, completadoAt: new Date() },
      update: { motivoRechazo: motivo, completadoPorId: userId, completadoAt: new Date() },
    });

    const actualizado = await tx.conciliationRecord.update({
      where: { id },
      data: { estado: "RECHAZADA_TECNICA" },
    });

    await tx.statusHistory.create({
      data: {
        recordId: id,
        estadoDesde: "EN_REVISION_TECNICA",
        estadoHasta: "RECHAZADA_TECNICA",
        comentario: motivo,
        cambiadoPorId: userId,
      },
    });

    const emailLog = await encolarCorreo({
      record: actualizado,
      trigger: "RECHAZO_TECNICO",
      destinatarios: [existente.creadoPor.email],
      motivo,
      tx,
    });

    return { record: actualizado, emailLogId: emailLog.id };
  });

  const enviado = await enviarCorreoInmediato(emailLogId);
  res.json({ ...record, emailEstado: enviado ? "ENVIADO" : "FALLIDO" });
}

/**
 * Rol Planeamiento (cualquier usuario del rol, no solo quien lo creó) o
 * ADMIN: da por buena la receta/actualización que entregó Documentación
 * Técnica. Cierre final del requerimiento.
 */
export async function concluirRegistro(req: Request, res: Response) {
  const { id } = req.params;
  const userId = req.user!.id;

  const existente = await prisma.conciliationRecord.findUnique({ where: { id } });
  if (!existente) throw new HttpError(404, "Registro no encontrado");
  if (req.user!.role !== "PLANEAMIENTO" && req.user!.role !== "ADMIN") {
    throw new HttpError(403, "Solo Planeamiento o un administrador puede concluir un requerimiento");
  }
  if (!ESTADOS_PENDIENTES_DECISION.includes(existente.estado as (typeof ESTADOS_PENDIENTES_DECISION)[number])) {
    throw new HttpError(409, "Este registro no está esperando la conclusión de Planeamiento");
  }

  const destinatarios = await destinatariosOriginales(id);

  const { record, emailLogId } = await prisma.$transaction(async (tx) => {
    const actualizado = await tx.conciliationRecord.update({ where: { id }, data: { estado: "CONCLUIDA" } });

    await tx.statusHistory.create({
      data: {
        recordId: id,
        estadoDesde: existente.estado,
        estadoHasta: "CONCLUIDA",
        cambiadoPorId: userId,
      },
    });

    const emailLog = await encolarCorreo({
      record: actualizado,
      trigger: "DECISION_PLANEAMIENTO",
      destinatarios,
      aprobado: true,
      tx,
    });

    return { record: actualizado, emailLogId: emailLog.id };
  });

  const enviado = destinatarios.length > 0 ? await enviarCorreoInmediato(emailLogId) : true;
  res.json({ ...record, emailEstado: enviado ? "ENVIADO" : "FALLIDO" });
}

/**
 * Rol Planeamiento (cualquier usuario del rol, no solo quien lo creó) o
 * ADMIN: rechaza la receta/actualización entregada y la devuelve a
 * Documentación Técnica con un motivo, para que la rehaga (vuelve a
 * EN_REVISION_TECNICA).
 */
export async function rechazarPlaneamiento(req: Request, res: Response) {
  const { id } = req.params;
  const { motivo } = rechazarPlaneamientoSchema.parse(req.body);
  const userId = req.user!.id;

  const existente = await prisma.conciliationRecord.findUnique({ where: { id } });
  if (!existente) throw new HttpError(404, "Registro no encontrado");
  if (req.user!.role !== "PLANEAMIENTO" && req.user!.role !== "ADMIN") {
    throw new HttpError(403, "Solo Planeamiento o un administrador puede rechazar un requerimiento");
  }
  if (!ESTADOS_PENDIENTES_DECISION.includes(existente.estado as (typeof ESTADOS_PENDIENTES_DECISION)[number])) {
    throw new HttpError(409, "Este registro no está esperando la conclusión de Planeamiento");
  }

  const destinatarios = await destinatariosOriginales(id);

  const { record, emailLogId } = await prisma.$transaction(async (tx) => {
    const actualizado = await tx.conciliationRecord.update({
      where: { id },
      data: { estado: "EN_REVISION_TECNICA" },
    });

    await tx.statusHistory.create({
      data: {
        recordId: id,
        estadoDesde: existente.estado,
        estadoHasta: "EN_REVISION_TECNICA",
        comentario: motivo,
        cambiadoPorId: userId,
      },
    });

    const emailLog = await encolarCorreo({
      record: actualizado,
      trigger: "DECISION_PLANEAMIENTO",
      destinatarios,
      aprobado: false,
      motivo,
      tx,
    });

    return { record: actualizado, emailLogId: emailLog.id };
  });

  const enviado = destinatarios.length > 0 ? await enviarCorreoInmediato(emailLogId) : true;
  res.json({ ...record, emailEstado: enviado ? "ENVIADO" : "FALLIDO" });
}

/**
 * Rol Planeamiento (dueño) o ADMIN: elimina un requerimiento que todavía no
 * se cerró con éxito (CONCLUIDA queda protegida, es el cierre exitoso final
 * para cualquiera). Un ADMIN puede forzar el borrado de un registro en
 * cualquier estado -por ejemplo para limpiar pruebas antes de un lanzamiento-;
 * en ese caso queda un rastro mínimo en EliminacionForzada, invisible en la
 * app, con quién lo hizo y de qué registro se trataba.
 */
export async function eliminarRegistro(req: Request, res: Response) {
  const { id } = req.params;
  const userId = req.user!.id;

  const existente = await prisma.conciliationRecord.findUnique({ where: { id } });
  if (!existente) throw new HttpError(404, "Registro no encontrado");
  if (existente.creadoPorId !== userId && req.user!.role !== "ADMIN") {
    throw new HttpError(403, "Solo quien creó el requerimiento puede borrarlo");
  }

  const eliminable = ESTADOS_ELIMINABLES.includes(existente.estado as (typeof ESTADOS_ELIMINABLES)[number]);
  if (!eliminable && req.user!.role !== "ADMIN") {
    throw new HttpError(409, "Un requerimiento ya concluido no se puede borrar");
  }

  // Los archivos de las notas viven en Supabase Storage, no en esta base de
  // datos: la fila se borra en cascada al borrar el registro, pero el
  // archivo en sí quedaría huérfano en el bucket para siempre si no se borra
  // explícitamente primero.
  const adjuntos = await prisma.notaAdjunto.findMany({
    where: { nota: { recordId: id } },
    select: { ruta: true },
  });
  await Promise.all(adjuntos.map((a) => borrarAdjunto(a.ruta)));

  if (!eliminable) {
    await prisma.eliminacionForzada.create({
      data: {
        registroId: existente.id,
        codigoProducto: existente.codigoProducto,
        producto: existente.producto,
        estadoAlBorrar: existente.estado,
        eliminadoPorId: userId,
        eliminadoPorNombre: req.user!.nombre,
        eliminadoPorEmail: req.user!.email,
      },
    });
  }

  await prisma.conciliationRecord.delete({ where: { id } });
  res.status(204).send();
}

/** Estados que cuentan como "todavía activo" para el aviso de duplicados: todo salvo el cierre exitoso final. */
const ESTADOS_ACTIVOS_DUPLICADO = [
  "PENDIENTE_PLANEAMIENTO",
  "EN_REVISION_TECNICA",
  "ENTREGADA",
  "RECHAZADA_TECNICA",
] as const;

/**
 * Rol Planeamiento: mientras se llena "Nuevo requerimiento" (o se edita uno
 * existente), avisa si ya hay otro requerimiento activo para el mismo
 * producto — por código si se conoce, si no por nombre — para que quien
 * solicita note que probablemente ya fue pedido antes de duplicarlo. No
 * bloquea nada: solo informa.
 */
export async function buscarDuplicados(req: Request, res: Response) {
  const { codigoProducto, producto, excluirId } = req.query as Record<string, string | undefined>;
  const codigo = codigoProducto?.trim();
  const nombre = producto?.trim();

  if (!codigo && (!nombre || nombre.length < 3)) {
    return res.json([]);
  }

  const registros = await prisma.conciliationRecord.findMany({
    where: {
      id: excluirId ? { not: excluirId } : undefined,
      estado: { in: [...ESTADOS_ACTIVOS_DUPLICADO] },
      ...(codigo ? { codigoProducto: { equals: codigo, mode: "insensitive" } } : { producto: { contains: nombre, mode: "insensitive" } }),
    },
    select: { id: true, producto: true, codigoProducto: true, estado: true, createdAt: true, creadoPor: { select: { nombre: true } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  res.json(registros);
}

export async function listarRegistros(req: Request, res: Response) {
  const { estado, planta, q } = req.query as Record<string, string | undefined>;

  const estadoFiltro =
    estado && (Object.values(EstadoRegistro) as string[]).includes(estado)
      ? (estado as EstadoRegistro)
      : undefined;

  const registros = await prisma.conciliationRecord.findMany({
    where: {
      estado: estadoFiltro,
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
      listasConciliar: { orderBy: { createdAt: "asc" } },
      historial: { orderBy: { createdAt: "asc" }, include: { cambiadoPor: { select: { nombre: true } } } },
    },
  });
  if (!registro) throw new HttpError(404, "Registro no encontrado");
  res.json(registro);
}
