import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { StatusBadge } from "../components/StatusBadge";
import { ESTADOS_REGISTRO, ESTADO_LABELS, TIPO_FLUJO_LABELS, type ConciliationRecord } from "../types";

export function Seguimiento() {
  const navigate = useNavigate();
  const [registros, setRegistros] = useState<ConciliationRecord[]>([]);
  const [q, setQ] = useState("");
  const [planta, setPlanta] = useState("");
  const [estado, setEstado] = useState("");
  const [loading, setLoading] = useState(true);

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
        ? r.producto.toLowerCase().includes(q.toLowerCase()) || (r.codigoProducto ?? "").toLowerCase().includes(q.toLowerCase())
        : true;
      const matchPlanta = planta ? r.planta === planta : true;
      const matchEstado = estado ? r.estado === estado : true;
      return matchQ && matchPlanta && matchEstado;
    });
  }, [registros, q, planta, estado]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Seguimiento de conciliaciones</h1>
          <p>{filtrados.length} de {registros.length} registro(s)</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate("/registros/nuevo")}>
          + Nuevo requerimiento
        </button>
      </div>

      <div className="filters">
        <input placeholder="Buscar por producto o código…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 240 }} />
        <select value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS_REGISTRO.map((e) => (
            <option key={e} value={e}>
              {ESTADO_LABELS[e]}
            </option>
          ))}
        </select>
        <select value={planta} onChange={(e) => setPlanta(e.target.value)}>
          <option value="">Todas las plantas</option>
          {plantas.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div className="table-wrap">
        {loading ? (
          <div className="empty-state">Cargando registros…</div>
        ) : filtrados.length === 0 ? (
          <div className="empty-state">No hay registros que coincidan con el filtro.</div>
        ) : (
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
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r) => (
                <tr key={r.id} onClick={() => navigate(`/registros/${r.id}`)}>
                  <td className="producto-cell">{r.producto}</td>
                  <td className="id-cell">{r.codigoProducto ?? "—"}</td>
                  <td>{r.planta}</td>
                  <td>
                    <StatusBadge estado={r.estado} />
                  </td>
                  <td>{r.tipoFlujo ? TIPO_FLUJO_LABELS[r.tipoFlujo] : "—"}</td>
                  <td>{r.creadoPor?.nombre ?? "—"}</td>
                  <td>{new Date(r.fechaConciliacion).toLocaleDateString("es-PE")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
