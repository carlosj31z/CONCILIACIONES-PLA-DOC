import { z } from "zod";
import { Role, TipoFlujo } from "@prisma/client";

// Una fila de la sección "Recetas a conciliar": una lista de materiales
// (BOM) elegida buscando en SAP (origen "SAP", con sus datos ya copiados) o
// escrita a mano (origen "MANUAL", requiere descripción).
export const listaConciliarSchema = z
  .object({
    origen: z.enum(["SAP", "MANUAL"]),
    material: z.string().trim().max(50).optional(),
    listaAlt: z.string().trim().max(20).optional(),
    producto: z.string().trim().max(200).optional(),
    centro: z.string().trim().max(50).optional(),
    estado: z.string().trim().max(50).optional(),
    descripcion: z.string().trim().max(500).optional(),
  })
  .refine((d) => (d.origen === "MANUAL" ? !!d.descripcion?.trim() : !!d.material?.trim()), {
    message: "Falta el código de material (si viene de SAP) o la descripción (si es manual)",
  });

export const crearRegistroSchema = z.object({
  codigoProducto: z.string().trim().max(50).optional(),
  producto: z.string().trim().min(2, "El producto es requerido"),
  planta: z.enum(["1", "2"], { errorMap: () => ({ message: "La planta debe ser 1 o 2" }) }),
  fechaConciliacion: z.coerce.date(),
  motivoConciliacion: z.string().trim().min(5, "El motivo es requerido"),
  materialesAConciliar: z.string().trim().min(2, "Los materiales a conciliar son requeridos"),
  asuntosRegulatorios: z.string().trim().optional(),
  listasConciliar: z.array(listaConciliarSchema).default([]),
});

export const actualizarRegistroSchema = z.object({
  codigoProducto: z.string().trim().max(50).optional(),
  producto: z.string().trim().min(2).optional(),
  planta: z.enum(["1", "2"]).optional(),
  fechaConciliacion: z.coerce.date().optional(),
  motivoConciliacion: z.string().trim().min(5).optional(),
  materialesAConciliar: z.string().trim().min(2).optional(),
  asuntosRegulatorios: z.string().trim().optional(),
});

export const decisionSchema = z.object({
  tipoFlujo: z.nativeEnum(TipoFlujo),
  destinatarios: z.array(z.string().trim().min(3)).min(1, "Ingresa al menos un destinatario"),
});

export const completarTecnicaSchema = z.object({
  variantes: z.string().trim().optional(),
  ejecucion: z.string().trim().optional(),
  observaciones: z.string().trim().optional(),
  destinatarios: z.array(z.string().trim().min(3)).min(1, "Ingresa al menos un destinatario"),
});

export const rechazarTecnicaSchema = z.object({
  motivo: z.string().trim().min(5, "Indica el motivo por el que no se pudo generar la receta"),
});

export const rechazarPlaneamientoSchema = z.object({
  motivo: z.string().trim().min(5, "Indica el motivo del rechazo"),
});

export const actualizarTecnicaSchema = z.object({
  variantes: z.string().trim().optional(),
  ejecucion: z.string().trim().optional(),
  observaciones: z.string().trim().optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
});

export const crearUsuarioSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre es requerido"),
  email: z.string().trim().email("Correo inválido"),
  role: z.nativeEnum(Role),
  puesto: z.string().trim().min(1).optional(),
});

export const actualizarUsuarioSchema = z.object({
  nombre: z.string().trim().min(2).optional(),
  role: z.nativeEnum(Role).optional(),
  activo: z.boolean().optional(),
  puesto: z.string().trim().min(1).optional(),
});

export const crearNotaSchema = z.object({
  contenido: z.string().trim().min(1, "La nota no puede estar vacía").max(5000),
  visibilidad: z.enum(["PRIVADA", "COMPARTIDA"]).default("COMPARTIDA"),
});

export const actualizarNotaSchema = z
  .object({
    contenido: z.string().trim().min(1).max(5000).optional(),
    visibilidad: z.enum(["PRIVADA", "COMPARTIDA"]).optional(),
  })
  .refine((d) => d.contenido !== undefined || d.visibilidad !== undefined, {
    message: "No hay nada que actualizar",
  });
