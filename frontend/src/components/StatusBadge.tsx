import { ESTADO_LABELS, type EstadoRegistro } from "../types";

const STYLES: Record<EstadoRegistro, { fg: string; bg: string }> = {
  PENDIENTE_PLANEAMIENTO: { fg: "var(--estado-pendiente)", bg: "var(--estado-pendiente-bg)" },
  EN_REVISION_TECNICA: { fg: "var(--estado-revision)", bg: "var(--estado-revision-bg)" },
  RECETA_GENERADA: { fg: "var(--estado-receta)", bg: "var(--estado-receta-bg)" },
  ACTUALIZACION_COMPLETADA: { fg: "var(--estado-actualizacion)", bg: "var(--estado-actualizacion-bg)" },
};

export function StatusBadge({ estado }: { estado: EstadoRegistro }) {
  const { fg, bg } = STYLES[estado];
  return (
    <span className="status-badge" style={{ color: fg, background: bg }}>
      <span className="dot" style={{ background: fg }} />
      {ESTADO_LABELS[estado]}
    </span>
  );
}
