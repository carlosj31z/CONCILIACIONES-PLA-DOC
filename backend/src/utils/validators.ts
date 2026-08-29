import { z } from "zod";

export const crearRegistroSchema = z.object({
  codigoProducto: z.string().trim().max(50).optional(),
  producto: z.string().trim().min(2, "El producto es requerido"),
  planta: z.string().trim().min(1, "La planta es requerida"),
  fechaConciliacion: z.coerce.date(),
  motivoConciliacion: z.string().trim().min(5, "El motivo es requerido"),
  lotes: z.array(z.string().trim().min(1)).default([]),
});

export const decisionSchema = z.object({
  tipoFlujo: z.enum(["GENERAR_RECETA", "ACTUALIZAR_SIN_CONCILIACION"]),
  destinatarios: z.array(z.string().trim().min(3)).min(1, "Ingresa al menos un destinatario"),
});

export const completarTecnicaSchema = z.object({
  variantes: z.string().trim().optional(),
  ejecucion: z.string().trim().optional(),
  observaciones: z.string().trim().optional(),
  destinatarios: z.array(z.string().trim().min(3)).min(1, "Ingresa al menos un destinatario"),
});

export const actualizarTecnicaSchema = z.object({
  variantes: z.string().trim().optional(),
  ejecucion: z.string().trim().optional(),
  observaciones: z.string().trim().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
