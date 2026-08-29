import { ESTADO_LABELS, type EstadoRegistro } from "../types";

const STYLES: Record<EstadoRegistro, { fg: string; bg: string }> = {
  PENDIENTE_PLANEAMIENTO: { fg: "#ffb020", bg: "rgba(255, 164, 18, 0.2)" },
  EN_REVISION_TECNICA: { fg: "#6a9fff", bg: "rgba(51, 102, 255, 0.2)" },
  RECETA_GENERADA: { fg: "#2fe07e", bg: "rgba(29, 224, 115, 0.2)" },
  ACTUALIZACION_COMPLETADA: { fg: "#26e3d2", bg: "rgba(18, 214, 196, 0.2)" },
  RECHAZADA_TECNICA: { fg: "#ff5c6c", bg: "rgba(255, 77, 94, 0.2)" },
  CONCLUIDA: { fg: "#c2f038", bg: "rgba(194, 240, 56, 0.2)" },
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
