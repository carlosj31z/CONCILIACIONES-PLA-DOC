import { ESTADO_LABELS, type EstadoRegistro } from "../types";

const STYLES: Record<EstadoRegistro, { fg: string; bg: string }> = {
  PENDIENTE_PLANEAMIENTO: { fg: "#fbbf24", bg: "rgba(245, 158, 11, 0.16)" },
  EN_REVISION_TECNICA: { fg: "#60a5fa", bg: "rgba(59, 130, 246, 0.16)" },
  RECETA_GENERADA: { fg: "#4ade80", bg: "rgba(34, 197, 94, 0.16)" },
  ACTUALIZACION_COMPLETADA: { fg: "#2dd4bf", bg: "rgba(20, 184, 166, 0.16)" },
  RECHAZADA_TECNICA: { fg: "#f87171", bg: "rgba(248, 113, 113, 0.16)" },
  CONCLUIDA: { fg: "#a3e635", bg: "rgba(163, 230, 53, 0.16)" },
};

export function StatusBadge({ estado }: { estado: EstadoRegistro }) {
  const { fg, bg } = STYLES[estado];
  return (
    <span className="status-badge" style={{ color: fg, background: bg }}>
      <span className="dot" />
      {ESTADO_LABELS[estado]}
    </span>
  );
}
