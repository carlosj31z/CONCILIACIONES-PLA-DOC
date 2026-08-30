export const ROLES = ["PLANEAMIENTO", "DOC_TECNICA", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const TIPOS_FLUJO = ["GENERAR_RECETA", "ACTUALIZAR_SIN_CONCILIACION"] as const;
export type TipoFlujo = (typeof TIPOS_FLUJO)[number];

export const ESTADOS_REGISTRO = [
  "PENDIENTE_PLANEAMIENTO",
  "EN_REVISION_TECNICA",
  "ENTREGADA",
  "RECHAZADA_TECNICA",
  "CONCLUIDA",
] as const;
export type EstadoRegistro = (typeof ESTADOS_REGISTRO)[number];

export const ESTADO_LABELS: Record<EstadoRegistro, string> = {
  PENDIENTE_PLANEAMIENTO: "Pendiente de Planeamiento",
  EN_REVISION_TECNICA: "En Revisión por Documentación Técnica",
  ENTREGADA: "Entregada por Documentación Técnica",
  RECHAZADA_TECNICA: "Rechazada por Documentación Técnica",
  CONCLUIDA: "Concluida",
};

/**
 * Versión corta de cada estado, para lugares angostos (tarjetas en celular)
 * donde la etiqueta completa se cortaría con puntos suspensivos —
 * "En Revisión por Docu…" no dice nada más que "En revisión" y ocupa el
 * doble. El contexto (una app de conciliaciones entre esas dos áreas) hace
 * que el "por Documentación Técnica" se sobreentienda.
 */
export const ESTADO_LABELS_CORTOS: Record<EstadoRegistro, string> = {
  PENDIENTE_PLANEAMIENTO: "Pendiente",
  EN_REVISION_TECNICA: "En revisión",
  ENTREGADA: "Entregada",
  RECHAZADA_TECNICA: "Rechazada",
  CONCLUIDA: "Concluida",
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
  puesto?: string | null;
}

export const ROLE_LABELS: Record<Role, string> = {
  PLANEAMIENTO: "Planeamiento",
  DOC_TECNICA: "Documentación Técnica",
  ADMIN: "Administrador",
};

export interface ManagedUser {
  id: string;
  nombre: string;
  email: string;
  role: Role;
  puesto?: string | null;
  activo: boolean;
  createdAt: string;
}

/**
 * Disparadores de correo del backend (enum TriggerCorreo de Prisma). El
 * listado "Notificaciones enviadas" es la traza de a quién se avisó y por
 * qué, así que cada uno necesita su propia etiqueta: antes se resolvían con
 * un ternario de dos ramas y las notificaciones de rechazo técnico y de
 * decisión de Planeamiento se mostraban, falsamente, como "receta lista".
 */
export const TRIGGER_LABELS: Record<TriggerCorreo, string> = {
  NUEVO_REQUERIMIENTO: "nuevo requerimiento",
  RECETA_LISTA: "receta lista",
  RECHAZO_TECNICO: "no se pudo generar",
  DECISION_PLANEAMIENTO: "decisión de Planeamiento",
};

/** En el orden en que ocurren dentro del flujo, para listarlos cronológicamente. */
export const TRIGGERS_CORREO = [
  "NUEVO_REQUERIMIENTO",
  "RECETA_LISTA",
  "RECHAZO_TECNICO",
  "DECISION_PLANEAMIENTO",
] as const;

export type TriggerCorreo = (typeof TRIGGERS_CORREO)[number];

export interface RegistroDuplicado {
  id: string;
  producto: string;
  codigoProducto: string | null;
  estado: EstadoRegistro;
  createdAt: string;
  creadoPor: { nombre: string };
}

export type VisibilidadNota = "PRIVADA" | "COMPARTIDA";

export interface NotaAdjunto {
  id: string;
  nombre: string;
  tipo: string;
  tamano: number;
  createdAt: string;
}

export interface RecordNota {
  id: string;
  contenido: string;
  visibilidad: VisibilidadNota;
  createdAt: string;
  updatedAt: string;
  autorId: string;
  autor: { nombre: string };
  adjuntos: NotaAdjunto[];
  /** La escribió quien está viendo: solo entonces se puede editar o borrar. */
  esMia: boolean;
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
  motivoRechazo?: string | null;
  completadoAt?: string | null;
  completadoPor?: { nombre: string } | null;
}

export interface DirectoryUser {
  id: string;
  nombre: string;
  email: string;
  role: Role;
}

export interface EmailRecipient {
  id: string;
  email: string;
  trigger: TriggerCorreo;
  createdAt: string;
}

export type OrigenListaConciliar = "SAP" | "MANUAL";

export interface ListaConciliar {
  id: string;
  origen: OrigenListaConciliar;
  material?: string | null;
  listaAlt?: string | null;
  producto?: string | null;
  centro?: string | null;
  estado?: string | null;
  descripcion?: string | null;
  createdAt?: string;
}

export interface StatusHistoryEntry {
  id: string;
  estadoDesde: EstadoRegistro | null;
  estadoHasta: EstadoRegistro;
  comentario?: string | null;
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
  materialesAConciliar: string;
  asuntosRegulatorios?: string | null;
  tipoFlujo: TipoFlujo | null;
  estado: EstadoRegistro;
  createdAt: string;
  updatedAt: string;
  creadoPorId?: string;
  creadoPor?: { nombre: string; email?: string };
  lotes?: RecordLote[];
  respuestaTecnica?: TechnicalResponse | null;
  destinatarios?: EmailRecipient[];
  listasConciliar?: ListaConciliar[];
  historial?: StatusHistoryEntry[];
  emailEstado?: "ENVIADO" | "FALLIDO";
}
