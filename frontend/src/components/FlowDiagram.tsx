const PASOS = [
  {
    numero: 1,
    titulo: "Planeamiento crea el requerimiento",
    detalle: "Producto, planta, materiales a conciliar y asuntos regulatorios.",
    tono: "flow-tone-pendiente",
  },
  {
    numero: 2,
    titulo: "Planeamiento elige ruta y notifica",
    detalle: "Generar receta o actualizar sin conciliación. Se avisa a Documentación Técnica.",
    tono: "flow-tone-revision",
  },
  {
    numero: 3,
    titulo: "Documentación Técnica trabaja el caso",
    detalle: "Completa variantes, ejecución y observaciones, o indica que no es posible.",
    tono: "flow-tone-revision",
  },
];

export function FlowDiagram() {
  return (
    <div className="flow-diagram" aria-label="Diagrama del proceso de conciliación">
      <div className="flow-row">
        {PASOS.map((paso, i) => (
          <div className="flow-step-group" key={paso.numero} style={{ animationDelay: `${i * 80}ms` }}>
            <div className={`flow-card ${paso.tono}`}>
              <span className="flow-step-number">{paso.numero}</span>
              <strong>{paso.titulo}</strong>
              <p>{paso.detalle}</p>
            </div>
            {i < PASOS.length - 1 && (
              <svg className="flow-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 12h14m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        ))}
      </div>

      <div className="flow-branches" style={{ animationDelay: "240ms" }}>
        <div className="flow-branch-connector" aria-hidden="true" />

        <div className="flow-card flow-tone-rechazada flow-branch-card">
          <strong>No se pudo generar</strong>
          <p>Documentación Técnica registra el motivo. Queda como “Rechazada por Documentación Técnica”.</p>
        </div>

        <div className="flow-branch-card flow-branch-loop">
          <div className="flow-card flow-tone-receta">
            <strong>Receta o actualización lista</strong>
            <p>Documentación Técnica completa el trabajo y notifica a Planeamiento.</p>
          </div>
          <div className="flow-loop-row">
            <svg className="flow-loop-arrow" viewBox="0 0 40 24" fill="none" aria-hidden="true">
              <path
                d="M36 4c0 6-6 6-16 6S4 12 4 18"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                fill="none"
              />
              <path d="M4 18l-3-4m3 4 4-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="hint">Planeamiento rechaza con motivo → vuelve a revisión técnica</span>
          </div>
          <div className="flow-card flow-tone-concluida">
            <strong>Planeamiento concluye</strong>
            <p>Da por buena la entrega. Cierre final del requerimiento.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
