import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../api/client";
import { LoadingState } from "../components/Spinner";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { useAuth } from "../context/AuthContext";
import { formatDuracion, tiempoResolucionMs } from "../utils/duration";
import { cardEntrance, listContainer, listItem, pressable } from "../lib/motion";
import { ESTADO_LABELS, type ConciliationRecord, type EstadoRegistro } from "../types";

const TONE: Record<EstadoRegistro, string> = {
  PENDIENTE_PLANEAMIENTO: "tone-pendiente",
  EN_REVISION_TECNICA: "tone-revision",
  ENTREGADA: "tone-entregada",
  RECHAZADA_TECNICA: "tone-rechazada",
  CONCLUIDA: "tone-concluida",
};

function haceMenosDe(iso: string, horas: number): boolean {
  return Date.now() - new Date(iso).getTime() < horas * 60 * 60 * 1000;
}

export function Panel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const verTiempos = user?.role === "DOC_TECNICA" || user?.role === "ADMIN";
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
      ENTREGADA: 0,
      RECHAZADA_TECNICA: 0,
      CONCLUIDA: 0,
    };
    for (const r of registros) base[r.estado]++;
    return base;
  }, [registros]);

  const creadosHoy = useMemo(() => registros.filter((r) => haceMenosDe(r.createdAt, 24)).length, [registros]);

  const tiempoPromedioResolucion = useMemo(() => {
    const duraciones = registros.map(tiempoResolucionMs).filter((ms): ms is number => ms !== null);
    if (duraciones.length === 0) return null;
    return duraciones.reduce((a, b) => a + b, 0) / duraciones.length;
  }, [registros]);

  const recientesCreados = useMemo(
    () => [...registros].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6),
    [registros]
  );

  const recientesCompletados = useMemo(
    () =>
      registros
        .filter((r) => r.estado === "ENTREGADA")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 6),
    [registros]
  );

  if (loading) return <LoadingState label="Cargando panel…" />;

  /** Al tocar un tile de estado se salta a Seguimiento ya filtrado por ese estado. */
  function verEstado(estado: EstadoRegistro) {
    navigate(`/?estado=${estado}`);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Panel de actividades</h1>
          <p>Resumen general del flujo de conciliaciones.</p>
        </div>
      </div>

      <motion.div className="stat-grid" variants={listContainer} initial="initial" animate="animate">
        <motion.div className="stat-tile tone-total" variants={listItem}>
          <span className="value">
            <AnimatedNumber value={registros.length} />
          </span>
          <span className="label">Total de registros</span>
        </motion.div>

        <motion.div className="stat-tile tone-hoy" variants={listItem}>
          <span className="value">
            <AnimatedNumber value={creadosHoy} />
          </span>
          <span className="label">Creados últimas 24h</span>
        </motion.div>

        {verTiempos && (
          <motion.div className="stat-tile tone-revision" variants={listItem}>
            <span className="value">
              {tiempoPromedioResolucion !== null ? formatDuracion(tiempoPromedioResolucion) : "—"}
            </span>
            <span className="label">Tiempo promedio de resolución</span>
          </motion.div>
        )}

        {(Object.keys(conteos) as EstadoRegistro[]).map((estado) => (
          <motion.button
            type="button"
            className={`stat-tile stat-tile-link ${TONE[estado]}`}
            key={estado}
            variants={listItem}
            onClick={() => verEstado(estado)}
            title={`Ver registros: ${ESTADO_LABELS[estado]}`}
            {...pressable}
          >
            <span className="value">
              <AnimatedNumber value={conteos[estado]} />
            </span>
            <span className="label">{ESTADO_LABELS[estado]}</span>
          </motion.button>
        ))}
      </motion.div>

      <div className="panel-grid">
        <motion.div className="card" variants={cardEntrance} initial="initial" animate="animate">
          <h3 className="card-eyebrow">Últimos requerimientos creados</h3>
          {recientesCreados.length === 0 && <p className="hint">Sin registros todavía.</p>}
          <motion.ul className="activity-list" variants={listContainer} initial="initial" animate="animate">
            {recientesCreados.map((r) => (
              <motion.li key={r.id} variants={listItem}>
                <Link to={`/registros/${r.id}`} className="title">
                  {r.producto}
                </Link>
                <div className="meta">
                  Planta {r.planta} · {r.creadoPor?.nombre ?? "—"} · {new Date(r.createdAt).toLocaleString("es-PE")}
                </div>
              </motion.li>
            ))}
          </motion.ul>
        </motion.div>

        <motion.div className="card" variants={cardEntrance} initial="initial" animate="animate">
          <h3 className="card-eyebrow">Últimas tareas completadas por Documentación Técnica</h3>
          {recientesCompletados.length === 0 && <p className="hint">Sin tareas completadas todavía.</p>}
          <motion.ul className="activity-list" variants={listContainer} initial="initial" animate="animate">
            {recientesCompletados.map((r) => (
              <motion.li key={r.id} variants={listItem}>
                <Link to={`/registros/${r.id}`} className="title">
                  {r.producto}
                </Link>
                <div className="meta">
                  Planta {r.planta} · {ESTADO_LABELS[r.estado]} · {new Date(r.updatedAt).toLocaleString("es-PE")}
                </div>
              </motion.li>
            ))}
          </motion.ul>
        </motion.div>
      </div>
    </div>
  );
}
