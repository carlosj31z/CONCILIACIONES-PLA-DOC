import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { StatusBadge } from "../components/StatusBadge";
import { ESTADOS_REGISTRO, ESTADO_LABELS, type ConciliationRecord, type EstadoRegistro } from "../types";

export function Dashboard() {
  const [registros, setRegistros] = useState<ConciliationRecord[]>([]);
  const [q, setQ] = useState("");
  const [planta, setPlanta] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<ConciliationRecord[]>("/records")
      .then(setRegistros)
      .finally(() => setLoading(false));
  }, []);

  const filtrados = useMemo(() => {
    return registros.filter((r) => {
      const matchQ = q ? r.producto.toLowerCase().includes(q.toLowerCase()) : true;
      const matchPlanta = planta ? r.planta === planta : true;
      return matchQ && matchPlanta;
    });
  }, [registros, q, planta]);

  const plantas = useMemo(() => Array.from(new Set(registros.map((r) => r.planta))).sort(), [registros]);

  const columnas: Record<EstadoRegistro, ConciliationRecord[]> = useMemo(() => {
    const grupos: Record<EstadoRegistro, ConciliationRecord[]> = {
      PENDIENTE_PLANEAMIENTO: [],
      EN_REVISION_TECNICA: [],
      RECETA_GENERADA: [],
      ACTUALIZACION_COMPLETADA: [],
    };
    for (const r of filtrados) grupos[r.estado].push(r);
    return grupos;
  }, [filtrados]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Tablero de registros</h1>
          <p>Estado de cumplimiento de cada requerimiento de conciliación.</p>
        </div>
        <Link to="/registros/nuevo" className="btn btn-primary">
          + Nuevo requerimiento
        </Link>
      </div>

      <div className="filters">
        <input placeholder="Buscar producto…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={planta} onChange={(e) => setPlanta(e.target.value)}>
          <option value="">Todas las plantas</option>
          {plantas.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p>Cargando registros…</p>
      ) : (
        <div className="board">
          {ESTADOS_REGISTRO.map((estado) => (
            <div className="board-column" key={estado}>
              <div className="board-column-title">
                <span>{ESTADO_LABELS[estado]}</span>
                <span>{columnas[estado].length}</span>
              </div>
              {columnas[estado].length === 0 && <div className="empty-column">Sin registros</div>}
              {columnas[estado].map((r) => (
                <Link to={`/registros/${r.id}`} className="record-card" key={r.id}>
                  <div className="producto">{r.producto}</div>
                  <div className="meta">
                    {r.planta} · {r.codigoProducto ?? "s/cód."}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <StatusBadge estado={r.estado} />
                  </div>
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
