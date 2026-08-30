import { Check } from "@phosphor-icons/react";
import type { ConciliationRecord } from "../types";

type StepState = "done" | "current" | "upcoming";

interface Step {
  label: string;
  state: StepState;
}

function construirPasos(record: ConciliationRecord): { pasos: Step[]; rechazada: boolean; concluida: boolean } {
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
      concluida: false,
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
        : estado === "ENTREGADA"
          ? 2
          : 3; // CONCLUIDA

  return {
    rechazada: false,
    concluida: estado === "CONCLUIDA",
    pasos: orden.map((p, i) => ({
      label: p.label,
      state: i < indiceActual ? "done" : i === indiceActual ? "current" : "upcoming",
    })),
  };
}

export function RecordFlowStatus({ record }: { record: ConciliationRecord }) {
  const { pasos, rechazada, concluida } = construirPasos(record);

  return (
    <div
      className={`flow-status${rechazada ? " flow-status-rechazada" : ""}${concluida ? " flow-status-concluida" : ""}`}
    >
      {pasos.map((paso, i) => {
        const esUltimo = i === pasos.length - 1;
        return (
          <div className={`flow-status-step flow-status-step--${paso.state}`} key={paso.label}>
            <div className="flow-status-track">
              {/*
                El punto va centrado en su propia columna (para alinear bien con
                la etiqueta de abajo), y cada línea conecta desde ahí hasta el
                borde de la columna — la mitad "before" de este paso y la mitad
                "after" del paso anterior forman, juntas, el tramo completo
                entre dos puntos consecutivos.
              */}
              {i > 0 && <span className="flow-status-line flow-status-line--before" />}
              <span className="flow-status-dot">
                {/*
                  Solo el punto final, y solo cuando la conciliación quedó
                  Concluida (el cierre real, no "Entregada" en camino):
                  un check dice "todo salió conforme" mejor que un punto
                  más del mismo tamaño que los demás.
                */}
                {concluida && esUltimo && <Check className="flow-status-check" size={11} weight="bold" />}
              </span>
              {!esUltimo && <span className="flow-status-line flow-status-line--after" />}
            </div>
            <span className="flow-status-label">{paso.label}</span>
          </div>
        );
      })}
    </div>
  );
}
