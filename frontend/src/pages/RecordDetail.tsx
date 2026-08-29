import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { StatusBadge } from "../components/StatusBadge";
import { EmailTagInput } from "../components/EmailTagInput";
import { useAuth } from "../context/AuthContext";
import { TIPO_FLUJO_LABELS, type ConciliationRecord } from "../types";

const ESTADOS_EDITABLES = ["PENDIENTE_PLANEAMIENTO", "EN_REVISION_TECNICA"];

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

  const [editando, setEditando] = useState(false);
  const [codigoProducto, setCodigoProducto] = useState("");
  const [producto, setProducto] = useState("");
  const [planta, setPlanta] = useState("1");
  const [fechaConciliacion, setFechaConciliacion] = useState("");
  const [motivoConciliacion, setMotivoConciliacion] = useState("");
  const [materialesAConciliar, setMaterialesAConciliar] = useState("");
  const [asuntosRegulatorios, setAsuntosRegulatorios] = useState("");
  const [guardandoDatos, setGuardandoDatos] = useState(false);

  function cargarDatosEdicion(r: ConciliationRecord) {
    setCodigoProducto(r.codigoProducto ?? "");
    setProducto(r.producto);
    setPlanta(r.planta);
    setFechaConciliacion(r.fechaConciliacion.slice(0, 10));
    setMotivoConciliacion(r.motivoConciliacion);
    setMaterialesAConciliar(r.materialesAConciliar);
    setAsuntosRegulatorios(r.asuntosRegulatorios ?? "");
  }

  function cargar() {
    if (!id) return;
    return api.get<ConciliationRecord>(`/records/${id}`).then((r) => {
      setRecord(r);
      setVariantes(r.respuestaTecnica?.variantes ?? "");
      setEjecucion(r.respuestaTecnica?.ejecucion ?? "");
      setObservaciones(r.respuestaTecnica?.observaciones ?? "");
      cargarDatosEdicion(r);
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
  const esDueno = user?.id === record.creadoPorId || user?.role === "ADMIN";
  const puedeEditarDatos = esDueno && ESTADOS_EDITABLES.includes(record.estado);

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
      const actualizado = await api.post<ConciliationRecord>(`/records/${id}/completar`, {
        variantes,
        ejecucion,
        observaciones,
        destinatarios,
      });
      await cargar();
      setAviso(
        actualizado.emailEstado === "FALLIDO"
          ? "Tarea completada, pero el correo de confirmación no se pudo enviar (se reintentará automáticamente)."
          : "Tarea completada y correo de confirmación despachado."
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo completar la tarea");
    } finally {
      setCompletando(false);
    }
  }

  async function guardarDatos() {
    setError(null);
    setGuardandoDatos(true);
    setAviso(null);
    try {
      await api.patch(`/records/${id}`, {
        codigoProducto: codigoProducto || undefined,
        producto,
        planta,
        fechaConciliacion,
        motivoConciliacion,
        materialesAConciliar,
        asuntosRegulatorios: asuntosRegulatorios || undefined,
      });
      setAviso("Datos del requerimiento actualizados.");
      setEditando(false);
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar los cambios");
    } finally {
      setGuardandoDatos(false);
    }
  }

  function cancelarEdicion() {
    cargarDatosEdicion(record!);
    setEditando(false);
    setError(null);
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0 }}>Datos del requerimiento</h3>
              {puedeEditarDatos && !editando && (
                <button className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => setEditando(true)}>
                  Editar
                </button>
              )}
            </div>

            {editando ? (
              <>
                <div className="form-grid">
                  <div className="form-field">
                    <label>Cód. Producto</label>
                    <input type="text" value={codigoProducto} onChange={(e) => setCodigoProducto(e.target.value)} />
                  </div>
                  <div className="form-field">
                    <label>Planta</label>
                    <select value={planta} onChange={(e) => setPlanta(e.target.value)}>
                      <option value="1">1</option>
                      <option value="2">2</option>
                    </select>
                  </div>
                  <div className="form-field span-2">
                    <label>Producto</label>
                    <input type="text" value={producto} onChange={(e) => setProducto(e.target.value)} required />
                  </div>
                  <div className="form-field">
                    <label>Fecha de conciliación</label>
                    <input type="date" value={fechaConciliacion} onChange={(e) => setFechaConciliacion(e.target.value)} required />
                  </div>
                  <div className="form-field span-2">
                    <label>Motivo de conciliación</label>
                    <textarea value={motivoConciliacion} onChange={(e) => setMotivoConciliacion(e.target.value)} required />
                  </div>
                  <div className="form-field span-2">
                    <label>Materiales a conciliar</label>
                    <textarea value={materialesAConciliar} onChange={(e) => setMaterialesAConciliar(e.target.value)} required />
                  </div>
                  <div className="form-field span-2">
                    <label>Asuntos regulatorios</label>
                    <textarea value={asuntosRegulatorios} onChange={(e) => setAsuntosRegulatorios(e.target.value)} />
                  </div>
                </div>

                {error && <div className="form-error">{error}</div>}

                <div className="form-actions">
                  <button className="btn btn-secondary" type="button" onClick={cancelarEdicion} disabled={guardandoDatos}>
                    Cancelar
                  </button>
                  <button className="btn btn-primary" type="button" onClick={guardarDatos} disabled={guardandoDatos}>
                    {guardandoDatos ? "Guardando…" : "Guardar cambios"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="form-field">
                  <label>Motivo de conciliación</label>
                  <div className="field-readonly">{record.motivoConciliacion}</div>
                </div>
                <div className="form-field">
                  <label>Materiales a conciliar</label>
                  <div className="field-readonly">{record.materialesAConciliar}</div>
                </div>
                <div className="form-field">
                  <label>Asuntos regulatorios</label>
                  <div className="field-readonly">{record.asuntosRegulatorios || "—"}</div>
                </div>
              </>
            )}
          </div>

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
                {!puedeEditarTecnica && aviso && <div className="hint">{aviso}</div>}
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
