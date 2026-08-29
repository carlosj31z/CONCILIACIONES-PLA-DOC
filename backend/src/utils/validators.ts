import { z } from "zod";
import { Role, TipoFlujo } from "@prisma/client";

export const crearRegistroSchema = z.object({
  codigoProducto: z.string().trim().max(50).optional(),
  producto: z.string().trim().min(2, "El producto es requerido"),
  planta: z.enum(["1", "2"], { errorMap: () => ({ message: "La planta debe ser 1 o 2" }) }),
  fechaConciliacion: z.coerce.date(),
  motivoConciliacion: z.string().trim().min(5, "El motivo es requerido"),
  materialesAConciliar: z.string().trim().min(2, "Los materiales a conciliar son requeridos"),
  asuntosRegulatorios: z.string().trim().optional(),
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
