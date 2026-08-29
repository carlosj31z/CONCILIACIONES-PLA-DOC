// Fuente única de verdad de los valores "tipo enum" que SQLite no puede
// modelar de forma nativa en Prisma. El frontend usa la misma lista de
// valores (ver frontend/src/types.ts) para mantener todo sincronizado.

export const ROLES = ["PLANEAMIENTO", "DOC_TECNICA", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const TIPOS_FLUJO = ["GENERAR_RECETA", "ACTUALIZAR_SIN_CONCILIACION"] as const;
export type TipoFlujo = (typeof TIPOS_FLUJO)[number];

export const ESTADOS_REGISTRO = [
  "PENDIENTE_PLANEAMIENTO",
  "EN_REVISION_TECNICA",
  "RECETA_GENERADA",
  "ACTUALIZACION_COMPLETADA",
] as const;
export type EstadoRegistro = (typeof ESTADOS_REGISTRO)[number];

export const TRIGGERS_CORREO = ["NUEVO_REQUERIMIENTO", "RECETA_LISTA"] as const;
export type TriggerCorreo = (typeof TRIGGERS_CORREO)[number];

export const ESTADOS_ENVIO_CORREO = ["PENDIENTE", "ENVIADO", "FALLIDO"] as const;
export type EstadoEnvioCorreo = (typeof ESTADOS_ENVIO_CORREO)[number];
