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

export const ESTADO_LABELS: Record<EstadoRegistro, string> = {
  PENDIENTE_PLANEAMIENTO: "Pendiente de Planeamiento",
  EN_REVISION_TECNICA: "En Revisión Técnica",
  RECETA_GENERADA: "Receta Generada",
  ACTUALIZACION_COMPLETADA: "Actualización Completada",
};

export const TIPO_FLUJO_LABELS: Record<TipoFlujo, string> = {
  GENERAR_RECETA: "Generar receta de conciliación",
  ACTUALIZAR_SIN_CONCILIACION: "Actualizar receta sin generar conciliación",
};

export interface AuthUser {
  id: string;
  email: string;
  nombre: string;
  role: Role;
}

export interface RecordLote {
  id: string;
  numeroLote: string;
  detalle?: string | null;
}

export interface TechnicalResponse {
  id: string;
  variantes?: string | null;
  ejecucion?: string | null;
  observaciones?: string | null;
  completadoAt?: string | null;
  completadoPor?: { nombre: string } | null;
}

export interface EmailRecipient {
  id: string;
  email: string;
  trigger: "NUEVO_REQUERIMIENTO" | "RECETA_LISTA";
  createdAt: string;
}

export interface StatusHistoryEntry {
  id: string;
  estadoDesde: EstadoRegistro | null;
  estadoHasta: EstadoRegistro;
  createdAt: string;
  cambiadoPor: { nombre: string };
}

export interface ConciliationRecord {
  id: string;
  codigoProducto?: string | null;
  producto: string;
  planta: string;
  fechaConciliacion: string;
  motivoConciliacion: string;
  tipoFlujo: TipoFlujo | null;
  estado: EstadoRegistro;
  createdAt: string;
  updatedAt: string;
  creadoPor?: { nombre: string; email?: string };
  lotes?: RecordLote[];
  respuestaTecnica?: TechnicalResponse | null;
  destinatarios?: EmailRecipient[];
  historial?: StatusHistoryEntry[];
}
