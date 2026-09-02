import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CaretDown } from "@phosphor-icons/react";
import { api, ApiError } from "../api/client";
import { cardEntrance, collapseVariants, pressable, springBouncy } from "../lib/motion";
import { StatusBadge } from "../components/StatusBadge";
import { AutoResizeTextarea } from "../components/AutoResizeTextarea";
import { EmailTagInput } from "../components/EmailTagInput";
import { MaterialLookup } from "../components/MaterialLookup";
import { RecetasConciliarSection, type NuevaReceta } from "../components/RecetasConciliarSection";
import { NotasSection } from "../components/NotasSection";
import { RecordFlowStatus } from "../components/RecordFlowStatus";
import { FormMessage } from "../components/FormMessage";
import { LoadingState, Spinner } from "../components/Spinner";
import { useAuth } from "../context/AuthContext";
import { formatDuracion, tiempoResolucionMs } from "../utils/duration";
import {
  ESTADO_LABELS,
  TIPO_FLUJO_LABELS,
  TIPOS_FLUJO,
  TRIGGER_LABELS,
  TRIGGERS_CORREO,
  type ConciliationRecord,
  type DirectoryUser,
  type RegistroDuplicado,
  type TipoFlujo,
  type TriggerCorreo,
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

  // Reanudar el envío a Documentación Técnica: si Planeamiento (o ADMIN)
  // creó el requerimiento y se fue de la página o la recargó antes de elegir
  // ruta y destinatarios, el registro queda "huérfano" en
  // PENDIENTE_PLANEAMIENTO sin forma de retomarlo — esto le da esa segunda
  // oportunidad desde el propio detalle del registro.
  const [tipoFlujoRuta, setTipoFlujoRuta] = useState<TipoFlujo | null>(null);
  const [destinatariosRuta, setDestinatariosRuta] = useState<string[]>([]);
  const [enviandoRuta, setEnviandoRuta] = useState(false);

  const [borrando, setBorrando] = useState(false);
  const [verFlujo, setVerFlujo] = useState(false);
  const [verNotificaciones, setVerNotificaciones] = useState(false);

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

  // Igual, pero para retomar el envío a Documentación Técnica cuando el
  // registro quedó pendiente de elegir ruta.
  useEffect(() => {
    if (record?.estado === "PENDIENTE_PLANEAMIENTO" && directorio.length > 0 && destinatariosRuta.length === 0) {
      setDestinatariosRuta(directorio.map((u) => u.email));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.estado, directorio]);

  /*
    "Notificaciones enviadas" es la traza de a quién se avisó y por qué. Sin
    agrupar salía un renglón por (destinatario × disparador) — unas 26 líneas
    en un registro que recorrió el flujo completo, que dominaban la columna
    entera. Se agrupa por disparador, en orden cronológico del flujo, y
    dentro de cada grupo se juntan los correos repetidos con un contador:
    que a alguien se le avisara dos veces (porque el requerimiento volvió a
    Documentación Técnica y se completó de nuevo) es información real de la
    traza, pero repetir la misma línea dos veces solo es ruido.
  */
  const gruposNotificacion = useMemo(() => {
    const porTrigger = new Map<TriggerCorreo, Map<string, number>>();
    for (const d of record?.destinatarios ?? []) {
      const grupo = porTrigger.get(d.trigger) ?? new Map<string, number>();
      grupo.set(d.email, (grupo.get(d.email) ?? 0) + 1);
      porTrigger.set(d.trigger, grupo);
    }
    return TRIGGERS_CORREO.filter((t) => porTrigger.has(t)).map((trigger) => ({
      trigger,
      correos: [...porTrigger.get(trigger)!.entries()]
        .map(([email, veces]) => ({ email, veces }))
        .sort((a, b) => a.email.localeCompare(b.email)),
    }));
  }, [record?.destinatarios]);

  const totalNotificados = new Set(
    gruposNotificacion.flatMap((g) => g.correos.map((c) => c.email))
  ).size;

  if (loading || !record) return <LoadingState label="Cargando registro…" />;

  const puedeEditarTecnica = user?.role === "DOC_TECNICA" || user?.role === "ADMIN";
  const verTiempos = user?.role === "DOC_TECNICA" || user?.role === "ADMIN";
  const msResolucion = tiempoResolucionMs(record);
  const enRevision = record.estado === "EN_REVISION_TECNICA";
  const esDueno = user?.id === record.creadoPorId || user?.role === "ADMIN";
  const puedeEditarDatos = esDueno && ESTADOS_EDITABLES.includes(record.estado);
  // Un ADMIN puede forzar el borrado incluso de un registro Concluido (ej.
  // para limpiar pruebas antes de un lanzamiento); nadie más puede tocar el
  // cierre exitoso final. El backend deja un rastro de esa acción aparte.
  const puedeBorrar = esDueno && (ESTADOS_ELIMINABLES.includes(record.estado) || user?.role === "ADMIN");
  const borradoForzado = !ESTADOS_ELIMINABLES.includes(record.estado);
  // La decisión final (concluir/rechazar) es de todo el rol Planeamiento, no
  // solo de quien creó el requerimiento — mismo alcance que ADMIN.
  const puedeDecidir =
    (user?.role === "PLANEAMIENTO" || user?.role === "ADMIN") &&
    ESTADOS_PENDIENTES_DECISION.includes(record.estado);
  // Permite retomar el paso "elegir ruta y notificar" cuando el registro se
  // quedó a medio camino (PENDIENTE_PLANEAMIENTO) porque quien lo creó salió
  // de la pantalla de alta antes de completarlo.
  const puedeIniciarRevision =
    (user?.role === "PLANEAMIENTO" || user?.role === "ADMIN") && record.estado === "PENDIENTE_PLANEAMIENTO";

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

  async function enviarARevision() {
    if (!id || !tipoFlujoRuta) return;
    setError(null);
    setEnviandoRuta(true);
    try {
      const actualizado = await api.post<ConciliationRecord>(`/records/${id}/decision`, {
        tipoFlujo: tipoFlujoRuta,
        destinatarios: destinatariosRuta,
      });
      await cargar();
      setAviso(
        actualizado.emailEstado === "FALLIDO"
          ? "Enviado a revisión técnica, pero el correo de notificación no se pudo despachar (se reintentará automáticamente)."
          : `Se notificó por correo a ${destinatariosRuta.length} destinatario(s). Documentación Técnica ya puede trabajar sobre este registro.`
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo enviar la notificación");
    } finally {
      setEnviandoRuta(false);
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
    const mensaje = borradoForzado
      ? `Este requerimiento ya está ${ESTADO_LABELS[record!.estado].toLowerCase()} — borrarlo ahora salta esa protección. Se van a borrar también sus notas y archivos adjuntos. Esta acción no se puede deshacer. ¿Continuar?`
      : "¿Borrar este requerimiento? Esta acción no se puede deshacer.";
    if (!confirm(mensaje)) return;
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
                    <MaterialLookup onSelect={(m) => setProducto(m.producto)} valorInicial={producto} />
                    <span className="hint">Elige el producto terminado desde SAP; es la única forma de fijar el Producto.</span>
                  </div>
                  <div className="form-field">
                    <label>Cód. Producto</label>
                    <div className="field-glow">
                      <input type="text" value={codigoProducto} onChange={(e) => setCodigoProducto(e.target.value)} />
                    </div>
                    <span className="hint">Se escribe a mano.</span>
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
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={guardarDatos}
                    disabled={guardandoDatos || !producto.trim()}
                  >
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

          {puedeIniciarRevision && (
            <div className="card detail-section">
              <h3>Enviar a Documentación Técnica</h3>
              <p className="hint" style={{ marginTop: 0 }}>
                Este requerimiento todavía no eligió ruta ni fue notificado. Puede que quien lo creó haya salido de
                esta pantalla o la haya recargado antes de terminar — completa este paso para continuar.
              </p>

              <div className="form-field">
                <label>Ruta del requerimiento</label>
                <div className="route-options" role="radiogroup" aria-label="Ruta del requerimiento">
                  {TIPOS_FLUJO.map((t) => (
                    <motion.button
                      type="button"
                      key={t}
                      role="radio"
                      aria-checked={tipoFlujoRuta === t}
                      className={`route-card${tipoFlujoRuta === t ? " selected" : ""}`}
                      onClick={() => setTipoFlujoRuta(t)}
                      {...pressable}
                    >
                      {tipoFlujoRuta === t && (
                        <motion.span className="route-card-ring" layoutId="route-selected-detalle" transition={springBouncy} />
                      )}
                      <strong>{TIPO_FLUJO_LABELS[t]}</strong>
                      {t === "GENERAR_RECETA"
                        ? "Genera una nueva receta de conciliación de materiales."
                        : "Actualiza la receta existente sin pasar por conciliación."}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="form-field">
                <label>Destinatarios de la notificación</label>
                <EmailTagInput
                  value={destinatariosRuta}
                  onChange={setDestinatariosRuta}
                  suggestions={directorio.map((u) => u.email)}
                  placeholder="Escribe un correo y presiona Enter…"
                />
                <span className="hint">Se prellenó con todos los usuarios; ajusta si hace falta.</span>
              </div>

              <FormMessage>{error}</FormMessage>

              <div className="form-actions">
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={enviarARevision}
                  disabled={!tipoFlujoRuta || destinatariosRuta.length === 0 || enviandoRuta}
                >
                  {enviandoRuta && <Spinner />}
                  {enviandoRuta ? "Enviando…" : "Enviar a Documentación Técnica"}
                </button>
              </div>
            </div>
          )}

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
                {!enRevision && record.estado === "PENDIENTE_PLANEAMIENTO" && !puedeIniciarRevision && (
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

          {/*
            Notas del requerimiento: al final de la columna principal, después
            de todo lo que define el estado del trámite. Son comentarios sobre
            la conciliación, no parte del flujo, así que no deben empujar hacia
            abajo lo que hay que decidir.
          */}
          <div className="card detail-section">
            <h3>Notas</h3>
            <NotasSection recordId={record.id} />
          </div>
        </div>

        <div>
          <div className="card detail-section">
            <h3>Creado por</h3>
            <div className="field-readonly">{record.creadoPor?.nombre}</div>
          </div>

          {gruposNotificacion.length > 0 && (
            <div className="card detail-section">
              <button
                type="button"
                className="notif-toggle"
                onClick={() => setVerNotificaciones((v) => !v)}
                aria-expanded={verNotificaciones}
              >
                <span className="notif-toggle-fila">
                  <h3>Notificaciones enviadas</h3>
                  <CaretDown size={13} weight="bold" className={verNotificaciones ? "notif-caret abierta" : "notif-caret"} />
                </span>
                <span className="hint">
                  {gruposNotificacion.length === 1 ? "1 aviso" : `${gruposNotificacion.length} avisos`} ·{" "}
                  {totalNotificados === 1 ? "1 destinatario" : `${totalNotificados} destinatarios`}
                </span>
              </button>

              <AnimatePresence initial={false}>
                {verNotificaciones && (
                  <motion.div
                    variants={collapseVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    style={{ overflow: "hidden" }}
                  >
                    {gruposNotificacion.map((g) => (
                      <div key={g.trigger} className="notif-grupo">
                        <div className="notif-grupo-titulo">
                          {TRIGGER_LABELS[g.trigger] ?? g.trigger}
                          <span className="notif-conteo">{g.correos.length}</span>
                        </div>
                        <div className="notif-correos">
                          {g.correos.map((c) => (
                            <span key={c.email} className="notif-correo">
                              {c.email}
                              {c.veces > 1 && <em className="notif-veces">×{c.veces}</em>}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
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
