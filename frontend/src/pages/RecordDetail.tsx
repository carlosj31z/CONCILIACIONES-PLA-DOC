import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { StatusBadge } from "../components/StatusBadge";
import { EmailTagInput } from "../components/EmailTagInput";
import { useAuth } from "../context/AuthContext";
import { TIPO_FLUJO_LABELS, type ConciliationRecord } from "../types";

export function RecordDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [record, setRecord] = useState<ConciliationRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const [variantes, setVariantes] = useState("");
  const [ejecucion, setEjecucion] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [destinatarios, setDestinatarios] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [completando, setCompletando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function cargar() {
    if (!id) return;
    return api.get<ConciliationRecord>(`/records/${id}`).then((r) => {
      setRecord(r);
      setVariantes(r.respuestaTecnica?.variantes ?? "");
      setEjecucion(r.respuestaTecnica?.ejecucion ?? "");
      setObservaciones(r.respuestaTecnica?.observaciones ?? "");
    });
  }

  useEffect(() => {
    setLoading(true);
    cargar()?.finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading || !record) return <p>Cargando registro…</p>;

  const puedeEditarTecnica = user?.role === "DOC_TECNICA" || user?.role === "ADMIN";
  const enRevision = record.estado === "EN_REVISION_TECNICA";

  async function guardarBorrador() {
    setError(null);
    setGuardando(true);
    setAviso(null);
    try {
      await api.patch(`/records/${id}/respuesta-tecnica`, { variantes, ejecucion, observaciones });
      setAviso("Borrador guardado.");
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function completarTarea() {
    setError(null);
    setCompletando(true);
    try {
      await api.post(`/records/${id}/completar`, { variantes, ejecucion, observaciones, destinatarios });
      await cargar();
      setAviso("Tarea completada y correo de confirmación despachado.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo completar la tarea");
    } finally {
      setCompletando(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{record.producto}</h1>
          <p>
            {record.codigoProducto ?? "Sin código"} · Planta {record.planta} ·{" "}
            {new Date(record.fechaConciliacion).toLocaleDateString("es-PE")}
          </p>
        </div>
        <StatusBadge estado={record.estado} />
      </div>

      <div className="detail-grid">
        <div>
          <div className="card detail-section">
            <h3>Motivo de conciliación</h3>
            <div className="field-readonly">{record.motivoConciliacion}</div>
          </div>

          {record.lotes && record.lotes.length > 0 && (
            <div className="card detail-section">
              <h3>Lotes</h3>
              {record.lotes.map((l) => (
                <span className="lote-chip" key={l.id}>
                  {l.numeroLote}
                </span>
              ))}
            </div>
          )}

          <div className="card detail-section">
            <h3>Documentación Técnica</h3>

            {record.tipoFlujo && (
              <p className="hint" style={{ marginTop: 0 }}>
                Ruta elegida: <strong>{TIPO_FLUJO_LABELS[record.tipoFlujo]}</strong>
              </p>
            )}

            {puedeEditarTecnica && enRevision ? (
              <>
                <div className="form-field">
                  <label>Variantes</label>
                  <textarea value={variantes} onChange={(e) => setVariantes(e.target.value)} />
                </div>
                <div className="form-field">
                  <label>Ejecución</label>
                  <textarea value={ejecucion} onChange={(e) => setEjecucion(e.target.value)} />
                </div>
                <div className="form-field">
                  <label>Observaciones</label>
                  <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
                </div>

                <div className="form-field">
                  <label>Destinatarios de la confirmación</label>
                  <EmailTagInput value={destinatarios} onChange={setDestinatarios} placeholder="Escribe un correo y presiona Enter…" />
                  <span className="hint">Se les notificará cuando marques la tarea como completada.</span>
                </div>

                {error && <div className="form-error">{error}</div>}
                {aviso && <div className="hint">{aviso}</div>}

                <div className="form-actions">
                  <button className="btn btn-secondary" onClick={guardarBorrador} disabled={guardando} type="button">
                    {guardando ? "Guardando…" : "Guardar borrador"}
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={completarTarea}
                    disabled={completando || destinatarios.length === 0}
                    type="button"
                  >
                    {completando ? "Completando…" : "Marcar como completada y notificar"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="form-field">
                  <label>Variantes</label>
                  <div className="field-readonly">{record.respuestaTecnica?.variantes || "—"}</div>
                </div>
                <div className="form-field">
                  <label>Ejecución</label>
                  <div className="field-readonly">{record.respuestaTecnica?.ejecucion || "—"}</div>
                </div>
                <div className="form-field">
                  <label>Observaciones</label>
                  <div className="field-readonly">{record.respuestaTecnica?.observaciones || "—"}</div>
                </div>
                {!enRevision && record.estado === "PENDIENTE_PLANEAMIENTO" && (
                  <p className="hint">Este registro aún no fue enviado a revisión técnica.</p>
                )}
              </>
            )}
          </div>
        </div>

        <div>
          <div className="card detail-section">
            <h3>Creado por</h3>
            <div className="field-readonly">{record.creadoPor?.nombre}</div>
          </div>

          {record.destinatarios && record.destinatarios.length > 0 && (
            <div className="card detail-section">
              <h3>Notificaciones enviadas</h3>
              {record.destinatarios.map((d) => (
                <div key={d.id} className="hint" style={{ marginBottom: 4 }}>
                  {d.email} <em>({d.trigger === "NUEVO_REQUERIMIENTO" ? "nuevo requerimiento" : "receta lista"})</em>
                </div>
              ))}
            </div>
          )}

          {record.historial && record.historial.length > 0 && (
            <div className="card detail-section">
              <h3>Historial</h3>
              <ul className="history-list">
                {record.historial.map((h) => (
                  <li key={h.id}>
                    <StatusBadge estado={h.estadoHasta} /> <br />
                    <span className="hint">
                      {h.cambiadoPor.nombre} · {new Date(h.createdAt).toLocaleString("es-PE")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
