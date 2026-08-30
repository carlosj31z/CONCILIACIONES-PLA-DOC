import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { api, ApiError } from "../api/client";
import { cardEntrance, collapseVariants, pressable } from "../lib/motion";
import { StatusBadge } from "../components/StatusBadge";
import { AutoResizeTextarea } from "../components/AutoResizeTextarea";
import { EmailTagInput } from "../components/EmailTagInput";
import { MaterialLookup } from "../components/MaterialLookup";
import { RecetasConciliarSection, type NuevaReceta } from "../components/RecetasConciliarSection";
import { RecordFlowStatus } from "../components/RecordFlowStatus";
import { FormMessage } from "../components/FormMessage";
import { LoadingState, Spinner } from "../components/Spinner";
import { useAuth } from "../context/AuthContext";
import { formatDuracion, tiempoResolucionMs } from "../utils/duration";
import {
  ESTADO_LABELS,
  TIPO_FLUJO_LABELS,
  TRIGGER_LABELS,
  type ConciliationRecord,
  type DirectoryUser,
  type RegistroDuplicado,
} from "../types";

const ESTADOS_EDITABLES = ["PENDIENTE_PLANEAMIENTO", "EN_REVISION_TECNICA"];
const ESTADOS_ELIMINABLES = ["PENDIENTE_PLANEAMIENTO", "EN_REVISION_TECNICA", "RECHAZADA_TECNICA", "ENTREGADA"];
const ESTADOS_PENDIENTES_DECISION = ["ENTREGADA"];

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

  const [duplicados, setDuplicados] = useState<RegistroDuplicado[]>([]);

  useEffect(() => {
    if (!editando || !id) {
      setDuplicados([]);
      return;
    }
    const codigo = codigoProducto.trim();
    const nombre = producto.trim();
    if (!codigo && nombre.length < 3) {
      setDuplicados([]);
      return;
    }
    const params = new URLSearchParams({ excluirId: id });
    if (codigo) params.set("codigoProducto", codigo);
    else params.set("producto", nombre);
    const timeout = setTimeout(() => {
      api
        .get<RegistroDuplicado[]>(`/records/duplicados?${params.toString()}`)
        .then(setDuplicados)
        .catch(() => setDuplicados([]));
    }, 400);
    return () => clearTimeout(timeout);
  }, [editando, id, codigoProducto, producto]);

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
      setDestinatarios(directorio.map((u) => u.email));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.estado, directorio]);

  if (loading || !record) return <LoadingState label="Cargando registro…" />;

  const puedeEditarTecnica = user?.role === "DOC_TECNICA" || user?.role === "ADMIN";
  const verTiempos = user?.role === "DOC_TECNICA" || user?.role === "ADMIN";
  const msResolucion = tiempoResolucionMs(record);
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

  async function agregarLista(item: NuevaReceta) {
    await api.post(`/records/${id}/listas-conciliar`, item);
    await cargar();
  }

  async function quitarLista(listaId: string) {
    await api.delete(`/records/${id}/listas-conciliar/${listaId}`);
    await cargar();
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
        <div className="detail-actions">
          <StatusBadge estado={record.estado} />
          <motion.button
            className="btn btn-secondary"
            onClick={() => setVerFlujo((v) => !v)}
            aria-expanded={verFlujo}
            {...pressable}
          >
            {verFlujo ? "Ocultar flujo" : "Ver flujo"}
          </motion.button>
          {puedeBorrar && (
            <motion.button className="btn btn-danger-ghost" onClick={borrar} disabled={borrando} {...pressable}>
              {borrando && <Spinner />}
              {borrando ? "Borrando…" : "Borrar"}
            </motion.button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {verFlujo && (
          <motion.div
            className="card flow-status-card"
            variants={collapseVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ overflow: "hidden" }}
          >
            <RecordFlowStatus record={record} />
          </motion.div>
        )}
      </AnimatePresence>

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
                  <div className="form-field span-2">
                    <label>Buscar en el Maestro de Materiales (SAP)</label>
                    <MaterialLookup
                      onSelect={(m) => {
                        setCodigoProducto(m.codigo);
                        setProducto(m.producto);
                      }}
                    />
                    <span className="hint">Opcional: elige un resultado para autocompletar Cód. Producto y Producto desde SAP.</span>
                  </div>
                  <div className="form-field">
                    <label>Cód. Producto</label>
                    <div className="field-glow">
                      <input type="text" value={codigoProducto} onChange={(e) => setCodigoProducto(e.target.value)} />
                    </div>
                  </div>
                  <div className="form-field field-compact">
                    <label>Planta</label>
                    <div className="field-glow">
                      <select value={planta} onChange={(e) => setPlanta(e.target.value)}>
                        <option value="1">1</option>
                        <option value="2">2</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-field span-2">
                    <label>Producto</label>
                    <div className="field-glow">
                      <input type="text" value={producto} onChange={(e) => setProducto(e.target.value)} required />
                    </div>
                  </div>
                  <div className="form-field span-2 field-compact">
                    <label>Fecha de conciliación</label>
                    <div className="field-glow">
                      <input type="date" value={fechaConciliacion} onChange={(e) => setFechaConciliacion(e.target.value)} required />
                    </div>
                  </div>
                  <div className="form-field span-2">
                    <label>Motivo de conciliación</label>
                    <div className="field-glow">
                      <AutoResizeTextarea value={motivoConciliacion} onChange={(e) => setMotivoConciliacion(e.target.value)} required />
                    </div>
                  </div>
                  <div className="form-field span-2">
                    <label>Materiales a conciliar</label>
                    <div className="field-glow">
                      <AutoResizeTextarea value={materialesAConciliar} onChange={(e) => setMaterialesAConciliar(e.target.value)} required />
                    </div>
                  </div>
                  <div className="form-field span-2">
                    <label>Asuntos regulatorios</label>
                    <div className="field-glow">
                      <AutoResizeTextarea value={asuntosRegulatorios} onChange={(e) => setAsuntosRegulatorios(e.target.value)} />
                    </div>
                  </div>
                </div>

                <FormMessage tone="warning">
                  {duplicados.length > 0 ? (
                    <>
                      <strong>
                        {duplicados.length === 1
                          ? "Ya existe otra conciliación activa para este producto:"
                          : `Ya existen ${duplicados.length} otras conciliaciones activas para este producto:`}
                      </strong>
                      <ul className="form-warning-list">
                        {duplicados.map((d) => (
                          <li key={d.id}>
                            <Link to={`/registros/${d.id}`} target="_blank" rel="noreferrer">
                              {d.producto} {d.codigoProducto ? `(${d.codigoProducto})` : ""}
                            </Link>{" "}
                            — {ESTADO_LABELS[d.estado]}, solicitada por {d.creadoPor.nombre}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </FormMessage>

                <FormMessage>{error}</FormMessage>

                <div className="form-actions">
                  <button className="btn btn-secondary" type="button" onClick={cancelarEdicion} disabled={guardandoDatos}>
                    Cancelar
                  </button>
                  <button className="btn btn-primary" type="button" onClick={guardarDatos} disabled={guardandoDatos}>
                    {guardandoDatos && <Spinner />}
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
            <h3>Recetas a conciliar</h3>
            <RecetasConciliarSection
              items={record.listasConciliar ?? []}
              onAdd={agregarLista}
              onRemove={quitarLista}
              disabled={!puedeEditarDatos}
            />
          </div>

          <div className="card detail-section">
            <h3>Documentación Técnica</h3>

            {record.tipoFlujo && (
              <p className="hint" style={{ marginTop: 0 }}>
                Ruta elegida: <strong>{TIPO_FLUJO_LABELS[record.tipoFlujo]}</strong>
              </p>
            )}

            {verTiempos && msResolucion !== null && (
              <p className="hint" style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
                Tiempo de resolución:
                <span className="duration-pill">{formatDuracion(msResolucion)}</span>
                <span style={{ color: "var(--color-text-muted)" }}>
                  (solicitado el {new Date(record.createdAt).toLocaleDateString("es-PE")}, resuelto el{" "}
                  {new Date(record.respuestaTecnica!.completadoAt!).toLocaleDateString("es-PE")})
                </span>
              </p>
            )}

            {verTiempos && msResolucion === null && record.estado === "EN_REVISION_TECNICA" && (
              <p className="hint" style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
                Tiempo en curso:
                <span className="duration-pill duration-pill--live">
                  <span className="duration-pill-dot" />
                  {formatDuracion(Date.now() - new Date(record.createdAt).getTime())}
                </span>
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
                    <div className="field-glow">
                      <AutoResizeTextarea value={motivoNoSePudo} onChange={(e) => setMotivoNoSePudo(e.target.value)} autoFocus />
                    </div>
                  </div>
                  <FormMessage>{error}</FormMessage>
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
                      {enviandoRechazoTecnica && <Spinner />}
                      {enviandoRechazoTecnica ? "Enviando…" : "Confirmar que no se pudo generar"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-field">
                    <label>Variantes</label>
                    <div className="field-glow">
                      <AutoResizeTextarea value={variantes} onChange={(e) => setVariantes(e.target.value)} />
                    </div>
                  </div>
                  <div className="form-field">
                    <label>Ejecución</label>
                    <div className="field-glow">
                      <AutoResizeTextarea value={ejecucion} onChange={(e) => setEjecucion(e.target.value)} />
                    </div>
                  </div>
                  <div className="form-field">
                    <label>Observaciones</label>
                    <div className="field-glow">
                      <AutoResizeTextarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
                    </div>
                  </div>

                  <div className="form-field">
                    <label>Destinatarios de la confirmación</label>
                    <EmailTagInput
                      value={destinatarios}
                      onChange={setDestinatarios}
                      suggestions={directorio.map((u) => u.email)}
                      placeholder="Escribe un correo y presiona Enter…"
                    />
                    <span className="hint">Se prellenó con todos los usuarios; ajusta si hace falta.</span>
                  </div>

                  <FormMessage>{error}</FormMessage>
                  <FormMessage tone="hint">{aviso}</FormMessage>

                  <div className="form-actions">
                    <button className="btn btn-secondary" onClick={guardarBorrador} disabled={guardando} type="button">
                      {guardando && <Spinner />}
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
                      {completando && <Spinner />}
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
                {/*
                  El aviso se muestra sin importar el rol. Antes estaba
                  condicionado a !puedeEditarTecnica y eso ocultaba la
                  confirmación justo a quien acababa de completar la tarea:
                  al completarla el registro pasa a ENTREGADA, deja de estar
                  "en revisión" y esta rama de solo lectura reemplaza al
                  formulario — con la condición vieja, Documentación Técnica
                  se quedaba sin ninguna señal de que la acción funcionó.
                  Las dos ramas son excluyentes, así que no hay riesgo de que
                  el mensaje aparezca dos veces.
                */}
                <FormMessage tone="hint">{aviso}</FormMessage>
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
                    <div className="field-glow">
                      <AutoResizeTextarea
                        value={motivoRechazoPlaneamiento}
                        onChange={(e) => setMotivoRechazoPlaneamiento(e.target.value)}
                        autoFocus
                      />
                    </div>
                  </div>
                  <FormMessage>{error}</FormMessage>
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
                      {decidiendo && <Spinner />}
                      {decidiendo ? "Enviando…" : "Rechazar y devolver a revisión"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <FormMessage>{error}</FormMessage>
                  <div className="form-actions">
                    <button className="btn btn-ghost-danger" type="button" onClick={() => setRechazandoPlaneamiento(true)} disabled={decidiendo}>
                      Rechazar
                    </button>
                    <button className="btn btn-primary" type="button" onClick={concluir} disabled={decidiendo}>
                      {decidiendo && <Spinner />}
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
                  {d.email} <em>({TRIGGER_LABELS[d.trigger] ?? d.trigger})</em>
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
