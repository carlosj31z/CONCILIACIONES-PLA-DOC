import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { StatusBadge } from "../components/StatusBadge";
import { EmailTagInput } from "../components/EmailTagInput";
import { RecordFlowStatus } from "../components/RecordFlowStatus";
import { useAuth } from "../context/AuthContext";
import { ESTADO_LABELS, TIPO_FLUJO_LABELS, type ConciliationRecord, type DirectoryUser } from "../types";

const ESTADOS_EDITABLES = ["PENDIENTE_PLANEAMIENTO", "EN_REVISION_TECNICA"];
const ESTADOS_ELIMINABLES = [
  "PENDIENTE_PLANEAMIENTO",
  "EN_REVISION_TECNICA",
  "RECHAZADA_TECNICA",
  "RECETA_GENERADA",
  "ACTUALIZACION_COMPLETADA",
];
const ESTADOS_PENDIENTES_DECISION = ["RECETA_GENERADA", "ACTUALIZACION_COMPLETADA"];

export function RecordDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [record, setRecord] = useState<ConciliationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [directorio, setDirectorio] = useState<DirectoryUser[]>([]);

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

  const [rechazandoTecnica, setRechazandoTecnica] = useState(false);
  const [motivoNoSePudo, setMotivoNoSePudo] = useState("");
  const [enviandoRechazoTecnica, setEnviandoRechazoTecnica] = useState(false);

  const [rechazandoPlaneamiento, setRechazandoPlaneamiento] = useState(false);
  const [motivoRechazoPlaneamiento, setMotivoRechazoPlaneamiento] = useState("");
  const [decidiendo, setDecidiendo] = useState(false);

  const [borrando, setBorrando] = useState(false);
  const [verFlujo, setVerFlujo] = useState(false);

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
    api
      .get<DirectoryUser[]>("/users/directorio")
      .then(setDirectorio)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Al entrar en revisión técnica, prellena los destinatarios de la confirmación con todo Planeamiento.
  useEffect(() => {
    if (record?.estado === "EN_REVISION_TECNICA" && directorio.length > 0 && destinatarios.length === 0) {
      setDestinatarios(directorio.filter((u) => u.role === "PLANEAMIENTO").map((u) => u.email));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.estado, directorio]);

  if (loading || !record) return <p>Cargando registro…</p>;

  const puedeEditarTecnica = user?.role === "DOC_TECNICA" || user?.role === "ADMIN";
  const enRevision = record.estado === "EN_REVISION_TECNICA";
  const esDueno = user?.id === record.creadoPorId || user?.role === "ADMIN";
  const puedeEditarDatos = esDueno && ESTADOS_EDITABLES.includes(record.estado);
  const puedeBorrar = esDueno && ESTADOS_ELIMINABLES.includes(record.estado);
  const puedeDecidir = esDueno && ESTADOS_PENDIENTES_DECISION.includes(record.estado);

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

  async function enviarRechazoTecnica() {
    setError(null);
    setEnviandoRechazoTecnica(true);
    try {
      await api.post(`/records/${id}/rechazar-tecnica`, { motivo: motivoNoSePudo });
      setRechazandoTecnica(false);
      await cargar();
      setAviso("Se avisó a Planeamiento de que no fue posible generar la receta.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo enviar el rechazo");
    } finally {
      setEnviandoRechazoTecnica(false);
    }
  }

  async function concluir() {
    setError(null);
    setDecidiendo(true);
    try {
      await api.post(`/records/${id}/concluir`, {});
      await cargar();
      setAviso("Requerimiento concluido.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo concluir el requerimiento");
    } finally {
      setDecidiendo(false);
    }
  }

  async function enviarRechazoPlaneamiento() {
    setError(null);
    setDecidiendo(true);
    try {
      await api.post(`/records/${id}/rechazar-planeamiento`, { motivo: motivoRechazoPlaneamiento });
      setRechazandoPlaneamiento(false);
      setMotivoRechazoPlaneamiento("");
      await cargar();
      setAviso("Se devolvió el requerimiento a Documentación Técnica con el motivo indicado.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo rechazar");
    } finally {
      setDecidiendo(false);
    }
  }

  async function borrar() {
    if (!confirm("¿Borrar este requerimiento? Esta acción no se puede deshacer.")) return;
    setError(null);
    setBorrando(true);
    try {
      await api.delete(`/records/${id}`);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo borrar el requerimiento");
      setBorrando(false);
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <StatusBadge estado={record.estado} />
          <button className="btn btn-secondary" onClick={() => setVerFlujo((v) => !v)}>
            {verFlujo ? "Ocultar flujo" : "Ver flujo"}
          </button>
          {puedeBorrar && (
            <button className="btn btn-danger-ghost" onClick={borrar} disabled={borrando}>
              {borrando ? "Borrando…" : "Borrar"}
            </button>
          )}
        </div>
      </div>

      {verFlujo && (
        <div className="card flow-status-card">
          <RecordFlowStatus record={record} />
        </div>
      )}

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

            {record.estado === "RECHAZADA_TECNICA" && (
              <div className="notice notice-danger">
                <strong>No se pudo generar la receta.</strong>
                <p style={{ margin: "4px 0 0" }}>{record.respuestaTecnica?.motivoRechazo}</p>
              </div>
            )}

            {puedeEditarTecnica && enRevision ? (
              rechazandoTecnica ? (
                <>
                  <div className="form-field">
                    <label>¿Por qué no se pudo generar la receta?</label>
                    <textarea value={motivoNoSePudo} onChange={(e) => setMotivoNoSePudo(e.target.value)} autoFocus />
                  </div>
                  {error && <div className="form-error">{error}</div>}
                  <div className="form-actions">
                    <button className="btn btn-secondary" type="button" onClick={() => setRechazandoTecnica(false)} disabled={enviandoRechazoTecnica}>
                      Cancelar
                    </button>
                    <button
                      className="btn btn-danger"
                      type="button"
                      onClick={enviarRechazoTecnica}
                      disabled={enviandoRechazoTecnica || motivoNoSePudo.trim().length < 5}
                    >
                      {enviandoRechazoTecnica ? "Enviando…" : "Confirmar que no se pudo generar"}
                    </button>
                  </div>
                </>
              ) : (
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
                    <EmailTagInput
                      value={destinatarios}
                      onChange={setDestinatarios}
                      suggestions={directorio.map((u) => u.email)}
                      placeholder="Escribe un correo y presiona Enter…"
                    />
                    <span className="hint">Se prellenó con todo el equipo de Planeamiento; ajusta si hace falta.</span>
                  </div>

                  {error && <div className="form-error">{error}</div>}
                  {aviso && <div className="hint">{aviso}</div>}

                  <div className="form-actions">
                    <button className="btn btn-secondary" onClick={guardarBorrador} disabled={guardando} type="button">
                      {guardando ? "Guardando…" : "Guardar borrador"}
                    </button>
                    <button className="btn btn-ghost-danger" type="button" onClick={() => setRechazandoTecnica(true)}>
                      No se pudo generar
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
              )
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

          {puedeDecidir && (
            <div className="card detail-section">
              <h3>Decisión de Planeamiento</h3>
              <p className="hint" style={{ marginTop: 0 }}>
                Documentación Técnica marcó este requerimiento como <strong>{ESTADO_LABELS[record.estado]}</strong>. Revisa
                el resultado y decide si lo concluyes o lo devuelves con un motivo.
              </p>

              {rechazandoPlaneamiento ? (
                <>
                  <div className="form-field">
                    <label>Motivo del rechazo</label>
                    <textarea
                      value={motivoRechazoPlaneamiento}
                      onChange={(e) => setMotivoRechazoPlaneamiento(e.target.value)}
                      autoFocus
                    />
                  </div>
                  {error && <div className="form-error">{error}</div>}
                  <div className="form-actions">
                    <button className="btn btn-secondary" type="button" onClick={() => setRechazandoPlaneamiento(false)} disabled={decidiendo}>
                      Cancelar
                    </button>
                    <button
                      className="btn btn-danger"
                      type="button"
                      onClick={enviarRechazoPlaneamiento}
                      disabled={decidiendo || motivoRechazoPlaneamiento.trim().length < 5}
                    >
                      {decidiendo ? "Enviando…" : "Rechazar y devolver a revisión"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {error && <div className="form-error">{error}</div>}
                  <div className="form-actions">
                    <button className="btn btn-ghost-danger" type="button" onClick={() => setRechazandoPlaneamiento(true)} disabled={decidiendo}>
                      Rechazar
                    </button>
                    <button className="btn btn-primary" type="button" onClick={concluir} disabled={decidiendo}>
                      {decidiendo ? "Concluyendo…" : "Concluir requerimiento"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
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
                    {h.comentario && <div className="history-comment">{h.comentario}</div>}
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
