import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../api/client";
import { StatusBadge } from "../components/StatusBadge";
import { LoadingState } from "../components/Spinner";
import { useAuth } from "../context/AuthContext";
import { formatDuracion, tiempoResolucionMs } from "../utils/duration";
import { listContainer, listItem, pressable } from "../lib/motion";
import { MOBILE_QUERY, useMediaQuery } from "../lib/useMediaQuery";
import { ESTADOS_REGISTRO, ESTADO_LABELS, TIPO_FLUJO_LABELS, type ConciliationRecord } from "../types";

function ResolucionCell({ record }: { record: ConciliationRecord }) {
  const ms = tiempoResolucionMs(record);
  if (ms !== null) {
    return (
      <span
        className="duration-pill"
        title={`Resuelto el ${new Date(record.respuestaTecnica!.completadoAt!).toLocaleString("es-PE")}`}
      >
        {formatDuracion(ms)}
      </span>
    );
  }
  if (record.estado === "EN_REVISION_TECNICA") {
    const enCurso = Date.now() - new Date(record.createdAt).getTime();
    return (
      <span className="duration-pill duration-pill--live" title="Documentación Técnica todavía la está resolviendo">
        <span className="duration-pill-dot" />
        {formatDuracion(enCurso)}
      </span>
    );
  }
  return <span className="id-cell">—</span>;
}

export function Seguimiento() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const esMovil = useMediaQuery(MOBILE_QUERY);
  const puedeCrear = user?.role === "PLANEAMIENTO" || user?.role === "ADMIN";
  const verTiempos = user?.role === "DOC_TECNICA" || user?.role === "ADMIN";
  const [registros, setRegistros] = useState<ConciliationRecord[]>([]);
  const [q, setQ] = useState("");
  const [planta, setPlanta] = useState("");
  const [loading, setLoading] = useState(true);

  /*
    El estado vive en la URL (no en useState) para que los tiles del Panel
    puedan enlazar a "Seguimiento ya filtrado por X" con un simple
    /?estado=…, y para que ese filtro sobreviva a recargar o compartir el
    enlace. Se valida contra la lista de estados conocidos: un ?estado=
    inventado a mano no debe dejar la tabla vacía sin explicación.
  */
  const [searchParams, setSearchParams] = useSearchParams();
  const estadoParam = searchParams.get("estado") ?? "";
  const estado = (ESTADOS_REGISTRO as readonly string[]).includes(estadoParam) ? estadoParam : "";

  function setEstado(nuevo: string) {
    setSearchParams(nuevo ? { estado: nuevo } : {}, { replace: true });
  }

  useEffect(() => {
    setLoading(true);
    api
      .get<ConciliationRecord[]>("/records")
      .then(setRegistros)
      .finally(() => setLoading(false));
  }, []);

  const plantas = useMemo(() => Array.from(new Set(registros.map((r) => r.planta))).sort(), [registros]);

  const filtrados = useMemo(() => {
    return registros.filter((r) => {
      const matchQ = q
        ? r.producto.toLowerCase().includes(q.toLowerCase()) ||
          (r.codigoProducto ?? "").toLowerCase().includes(q.toLowerCase())
        : true;
      const matchPlanta = planta ? r.planta === planta : true;
      const matchEstado = estado ? r.estado === estado : true;
      return matchQ && matchPlanta && matchEstado;
    });
  }, [registros, q, planta, estado]);

  const hayFiltroActivo = q !== "" || planta !== "" || estado !== "";

  function abrir(id: string) {
    navigate(`/registros/${id}`);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Seguimiento de conciliaciones</h1>
          <p>
            {filtrados.length} de {registros.length} registro(s)
          </p>
        </div>
        {puedeCrear && (
          <motion.button className="btn btn-primary" onClick={() => navigate("/registros/nuevo")} {...pressable}>
            + Nuevo requerimiento
          </motion.button>
        )}
      </div>

      <div className="filters">
        <input
          placeholder="Buscar por producto o código…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar por producto o código"
        />
        <select value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Filtrar por estado">
          <option value="">Todos los estados</option>
          {ESTADOS_REGISTRO.map((e) => (
            <option key={e} value={e}>
              {ESTADO_LABELS[e]}
            </option>
          ))}
        </select>
        <select value={planta} onChange={(e) => setPlanta(e.target.value)} aria-label="Filtrar por planta">
          <option value="">Todas las plantas</option>
          {plantas.map((p) => (
            <option key={p} value={p}>
              Planta {p}
            </option>
          ))}
        </select>
        <AnimatePresence>
          {hayFiltroActivo && (
            <motion.button
              type="button"
              className="btn btn-secondary filters-clear"
              onClick={() => {
                setQ("");
                setPlanta("");
                setEstado("");
              }}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              {...pressable}
            >
              Limpiar filtros
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {loading ? (
        <div className="table-wrap">
          <div className="empty-state">
            <LoadingState label="Cargando registros…" />
          </div>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="table-wrap">
          <div className="empty-state">
            {registros.length === 0
              ? "Todavía no hay requerimientos registrados."
              : "No hay registros que coincidan con el filtro."}
          </div>
        </div>
      ) : esMovil ? (
        /* --- Celular: una tarjeta por registro ---
           En una tabla, con 7-9 columnas, el celular obliga a desplazarse en
           horizontal y el estado (el dato más consultado) queda cortado
           fuera de pantalla. La tarjeta muestra lo mismo en vertical. */
        <motion.div className="record-cards" variants={listContainer} initial="initial" animate="animate">
          {filtrados.map((r) => (
            <motion.button
              type="button"
              className="record-card"
              key={r.id}
              variants={listItem}
              onClick={() => abrir(r.id)}
              {...pressable}
            >
              <div className="record-card-top">
                <span className="record-card-producto">{r.producto}</span>
                <StatusBadge estado={r.estado} compact />
              </div>
              <div className="record-card-meta">
                <span className="id-cell">{r.codigoProducto ?? "Sin código"}</span>
                <span aria-hidden="true">·</span>
                <span>Planta {r.planta}</span>
                <span aria-hidden="true">·</span>
                <span>{new Date(r.fechaConciliacion).toLocaleDateString("es-PE")}</span>
              </div>
              {r.tipoFlujo && <div className="record-card-ruta">{TIPO_FLUJO_LABELS[r.tipoFlujo]}</div>}
              <div className="record-card-foot">
                <span>{r.creadoPor?.nombre ?? "—"}</span>
                {verTiempos && <ResolucionCell record={r} />}
              </div>
            </motion.button>
          ))}
        </motion.div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cód.</th>
                <th>Planta</th>
                <th>Estado</th>
                <th>Ruta</th>
                <th>Creado por</th>
                <th>Fecha de conciliación</th>
                {verTiempos && <th>Solicitado</th>}
                {verTiempos && <th>Tiempo de resolución</th>}
              </tr>
            </thead>
            <motion.tbody variants={listContainer} initial="initial" animate="animate">
              {filtrados.map((r) => (
                /*
                  Una fila clickeable no es enfocable ni activable por teclado
                  por sí sola: hay que darle tabIndex, anunciarla como botón y
                  atender Enter/Espacio a mano. Sin esto, la única forma de
                  abrir un registro en escritorio es con el mouse.
                */
                <motion.tr
                  key={r.id}
                  variants={listItem}
                  onClick={() => abrir(r.id)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Abrir ${r.producto}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      abrir(r.id);
                    }
                  }}
                >
                  <td className="producto-cell">{r.producto}</td>
                  <td className="id-cell">{r.codigoProducto ?? "—"}</td>
                  <td>{r.planta}</td>
                  <td>
                    <StatusBadge estado={r.estado} />
                  </td>
                  <td>{r.tipoFlujo ? TIPO_FLUJO_LABELS[r.tipoFlujo] : "—"}</td>
                  <td>{r.creadoPor?.nombre ?? "—"}</td>
                  <td>{new Date(r.fechaConciliacion).toLocaleDateString("es-PE")}</td>
                  {verTiempos && <td>{new Date(r.createdAt).toLocaleDateString("es-PE")}</td>}
                  {verTiempos && (
                    <td>
                      <ResolucionCell record={r} />
                    </td>
                  )}
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        </div>
      )}
    </div>
  );
}
