import type { ConciliationRecord } from "../types";

type StepState = "done" | "current" | "upcoming";

interface Step {
  label: string;
  state: StepState;
}

function construirPasos(record: ConciliationRecord): { pasos: Step[]; rechazada: boolean } {
  const { estado, tipoFlujo } = record;
  const etiquetaEntrega =
    tipoFlujo === "GENERAR_RECETA"
      ? "Receta generada"
      : tipoFlujo === "ACTUALIZAR_SIN_CONCILIACION"
        ? "Actualización completada"
        : "Entrega de Doc. Técnica";

  const orden: { estado: string; label: string }[] = [
    { estado: "PENDIENTE_PLANEAMIENTO", label: "Creado por Planeamiento" },
    { estado: "EN_REVISION_TECNICA", label: "En revisión por Doc. Técnica" },
    { estado: "ENTREGA", label: etiquetaEntrega },
    { estado: "CONCLUIDA", label: "Concluida" },
  ];

  if (estado === "RECHAZADA_TECNICA") {
    return {
      rechazada: true,
      pasos: [
        { label: orden[0].label, state: "done" },
        { label: orden[1].label, state: "done" },
        { label: "Rechazada por Doc. Técnica", state: "current" },
      ],
    };
  }

  const indiceActual =
    estado === "PENDIENTE_PLANEAMIENTO"
      ? 0
      : estado === "EN_REVISION_TECNICA"
        ? 1
        : estado === "RECETA_GENERADA" || estado === "ACTUALIZACION_COMPLETADA"
          ? 2
          : 3; // CONCLUIDA

  return {
    rechazada: false,
    pasos: orden.map((p, i) => ({
      label: p.label,
      state: i < indiceActual ? "done" : i === indiceActual ? "current" : "upcoming",
    })),
  };
}

export function RecordFlowStatus({ record }: { record: ConciliationRecord }) {
  const { pasos, rechazada } = construirPasos(record);

  return (
    <div className={`flow-status${rechazada ? " flow-status-rechazada" : ""}`}>
      {pasos.map((paso, i) => (
        <div className={`flow-status-step flow-status-step--${paso.state}`} key={paso.label}>
          <div className="flow-status-track">
            <span className="flow-status-dot" />
            {i < pasos.length - 1 && <span className="flow-status-line" />}
          </div>
          <span className="flow-status-label">{paso.label}</span>
        </div>
      ))}
    </div>
  );
}
