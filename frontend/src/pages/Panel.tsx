import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { LoadingState } from "../components/Spinner";
import { ESTADO_LABELS, type ConciliationRecord, type EstadoRegistro } from "../types";

const TONE: Record<EstadoRegistro, string> = {
  PENDIENTE_PLANEAMIENTO: "tone-pendiente",
  EN_REVISION_TECNICA: "tone-revision",
  RECETA_GENERADA: "tone-receta",
  ACTUALIZACION_COMPLETADA: "tone-actualizacion",
  RECHAZADA_TECNICA: "tone-rechazada",
  CONCLUIDA: "tone-concluida",
};

function haceMenosDe(iso: string, horas: number): boolean {
  return Date.now() - new Date(iso).getTime() < horas * 60 * 60 * 1000;
}

export function Panel() {
  const [registros, setRegistros] = useState<ConciliationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<ConciliationRecord[]>("/records")
      .then(setRegistros)
      .finally(() => setLoading(false));
  }, []);

  const conteos = useMemo(() => {
    const base: Record<EstadoRegistro, number> = {
      PENDIENTE_PLANEAMIENTO: 0,
      EN_REVISION_TECNICA: 0,
      RECETA_GENERADA: 0,
      ACTUALIZACION_COMPLETADA: 0,
      RECHAZADA_TECNICA: 0,
      CONCLUIDA: 0,
    };
    for (const r of registros) base[r.estado]++;
    return base;
  }, [registros]);

  const creadosHoy = useMemo(() => registros.filter((r) => haceMenosDe(r.createdAt, 24)).length, [registros]);

  const recientesCreados = useMemo(
    () => [...registros].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6),
    [registros]
  );

  const recientesCompletados = useMemo(
    () =>
      registros
        .filter((r) => r.estado === "RECETA_GENERADA" || r.estado === "ACTUALIZACION_COMPLETADA")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 6),
    [registros]
  );

  if (loading) return <LoadingState label="Cargando panel…" />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Panel de actividades</h1>
          <p>Resumen general del flujo de conciliaciones.</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-tile tone-total">
          <span className="value">{registros.length}</span>
          <span className="label">Total de registros</span>
        </div>
        <div className="stat-tile tone-hoy">
          <span className="value">{creadosHoy}</span>
          <span className="label">Creados últimas 24h</span>
        </div>
        {(Object.keys(conteos) as EstadoRegistro[]).map((estado) => (
          <div className={`stat-tile ${TONE[estado]}`} key={estado}>
            <span className="value">{conteos[estado]}</span>
            <span className="label">{ESTADO_LABELS[estado]}</span>
          </div>
        ))}
      </div>

      <div className="panel-grid">
        <div className="card">
          <h3 style={{ marginTop: 0, fontSize: 14, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Últimos requerimientos creados
          </h3>
          {recientesCreados.length === 0 && <p className="hint">Sin registros todavía.</p>}
          <ul className="activity-list">
            {recientesCreados.map((r) => (
              <li key={r.id}>
                <Link to={`/registros/${r.id}`} className="title" style={{ textDecoration: "none" }}>
                  {r.producto}
                </Link>
                <div className="meta">
                  {r.planta} · {r.creadoPor?.nombre ?? "—"} · {new Date(r.createdAt).toLocaleString("es-PE")}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0, fontSize: 14, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Últimas tareas completadas por Documentación Técnica
          </h3>
          {recientesCompletados.length === 0 && <p className="hint">Sin tareas completadas todavía.</p>}
          <ul className="activity-list">
            {recientesCompletados.map((r) => (
              <li key={r.id}>
                <Link to={`/registros/${r.id}`} className="title" style={{ textDecoration: "none" }}>
                  {r.producto}
                </Link>
                <div className="meta">
                  {r.planta} · {ESTADO_LABELS[r.estado]} · {new Date(r.updatedAt).toLocaleString("es-PE")}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
