import { ESTADO_LABELS, ESTADO_LABELS_CORTOS, type EstadoRegistro } from "../types";

const STYLES: Record<EstadoRegistro, { fg: string; bg: string }> = {
  PENDIENTE_PLANEAMIENTO: { fg: "#ffb020", bg: "rgba(255, 164, 18, 0.2)" },
  EN_REVISION_TECNICA: { fg: "#6a9fff", bg: "rgba(51, 102, 255, 0.2)" },
  ENTREGADA: { fg: "#2fe07e", bg: "rgba(29, 224, 115, 0.2)" },
  RECHAZADA_TECNICA: { fg: "#ff5c6c", bg: "rgba(255, 77, 94, 0.2)" },
  CONCLUIDA: { fg: "#c2f038", bg: "rgba(194, 240, 56, 0.2)" },
};

interface StatusBadgeProps {
  estado: EstadoRegistro;
  /**
   * Usa la etiqueta corta. Para espacios angostos (tarjetas en celular),
   * donde la completa se cortaría con puntos suspensivos. El `title`
   * conserva el nombre completo para quien pase el cursor o use un lector
   * de pantalla.
   */
  compact?: boolean;
}

export function StatusBadge({ estado, compact }: StatusBadgeProps) {
  const { fg, bg } = STYLES[estado];
  return (
    <span
      className="status-badge"
      style={{ color: fg, background: bg }}
      title={ESTADO_LABELS[estado]}
    >
      <span className="dot" />
      {compact ? ESTADO_LABELS_CORTOS[estado] : ESTADO_LABELS[estado]}
    </span>
  );
}
