import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { motion } from "framer-motion";
import { AutoResizeTextarea } from "../components/AutoResizeTextarea";
import { EmailTagInput } from "../components/EmailTagInput";
import { FormMessage } from "../components/FormMessage";
import { MaterialLookup } from "../components/MaterialLookup";
import { RecetasConciliarSection, type NuevaReceta } from "../components/RecetasConciliarSection";
import { Spinner } from "../components/Spinner";
import { cardEntrance, pressable, springBouncy } from "../lib/motion";
import {
  ESTADO_LABELS,
  TIPO_FLUJO_LABELS,
  TIPOS_FLUJO,
  type ConciliationRecord,
  type DirectoryUser,
  type ListaConciliar,
  type RegistroDuplicado,
  type TipoFlujo,
} from "../types";

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function NewRecord() {
  const navigate = useNavigate();

  // Paso 1: datos base del requerimiento.
  const [codigoProducto, setCodigoProducto] = useState("");
  const [producto, setProducto] = useState("");
  const [planta, setPlanta] = useState("1");
  const [fechaConciliacion, setFechaConciliacion] = useState(hoyISO());
  const [motivoConciliacion, setMotivoConciliacion] = useState("");
  const [materialesAConciliar, setMaterialesAConciliar] = useState("");
  const [asuntosRegulatorios, setAsuntosRegulatorios] = useState("");
  const [listasConciliar, setListasConciliar] = useState<ListaConciliar[]>([]);
  const [duplicados, setDuplicados] = useState<RegistroDuplicado[]>([]);

  // Mientras se llena el producto, avisa (sin bloquear) si ya hay un
  // requerimiento activo para el mismo código o nombre — para que quien
  // solicita note que probablemente ya fue pedido antes de duplicarlo.
  useEffect(() => {
    const codigo = codigoProducto.trim();
    const nombre = producto.trim();
    if (!codigo && nombre.length < 3) {
      setDuplicados([]);
      return;
    }
    const params = new URLSearchParams();
    if (codigo) params.set("codigoProducto", codigo);
    else params.set("producto", nombre);
    const timeout = setTimeout(() => {
      api
        .get<RegistroDuplicado[]>(`/records/duplicados?${params.toString()}`)
        .then(setDuplicados)
        .catch(() => setDuplicados([]));
    }, 400);
    return () => clearTimeout(timeout);
  }, [codigoProducto, producto]);

  // Paso 2: decisión de flujo + notificación.
  const [record, setRecord] = useState<ConciliationRecord | null>(null);
  const [tipoFlujo, setTipoFlujo] = useState<TipoFlujo | null>(null);
  const [destinatarios, setDestinatarios] = useState<string[]>([]);
  const [directorio, setDirectorio] = useState<DirectoryUser[]>([]);
  const [emailFallido, setEmailFallido] = useState(false);

  useEffect(() => {
    if (!record) return;
    api
      .get<DirectoryUser[]>("/users/directorio")
      .then((usuarios) => {
        setDirectorio(usuarios);
        setDestinatarios(usuarios.map((u) => u.email));
      })
      .catch(() => {
        // El directorio es una comodidad (prellenar); si falla, el usuario igual puede escribir los correos a mano.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function handleCrear(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const nuevo = await api.post<ConciliationRecord>("/records", {
        codigoProducto: codigoProducto || undefined,
        producto,
        planta,
        fechaConciliacion,
        motivoConciliacion,
        materialesAConciliar,
        asuntosRegulatorios: asuntosRegulatorios || undefined,
        listasConciliar: listasConciliar.map(({ id, ...resto }) => resto),
      });
      setRecord(nuevo);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el registro");
    } finally {
      setLoading(false);
    }
  }

  async function handleEnviarARevision(e: FormEvent) {
    e.preventDefault();
    if (!record || !tipoFlujo) return;
    setError(null);
    setLoading(true);
    try {
      const actualizado = await api.post<ConciliationRecord>(`/records/${record.id}/decision`, {
        tipoFlujo,
        destinatarios,
      });
      setEmailFallido(actualizado.emailEstado === "FALLIDO");
      setEnviado(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo enviar la notificación");
    } finally {
      setLoading(false);
    }
  }

  if (enviado) {
    return (
      <motion.div
        className="card new-record-done"
        variants={cardEntrance}
        initial="initial"
        animate="animate"
      >
        <h1 className="new-record-done-title">Requerimiento enviado a revisión técnica</h1>
        {emailFallido ? (
          <p className="form-error" style={{ marginTop: 0 }}>
            El registro se envió a revisión técnica, pero el correo automático a {destinatarios.length}{" "}
            destinatario(s) no se pudo despachar (fallo de conexión con el servidor de correo). El sistema lo
            reintentará automáticamente; si sigue fallando, avisa a Documentación Técnica por otro medio.
          </p>
        ) : (
          <p>
            Se notificó por correo a {destinatarios.length} destinatario(s). Documentación Técnica ya puede
            trabajar sobre este registro.
          </p>
        )}
        <motion.button className="btn btn-primary" onClick={() => navigate(`/registros/${record!.id}`)} {...pressable}>
          Ver registro
        </motion.button>
      </motion.div>
    );
  }

  // --- Paso 2 ---
  if (record) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1>Elegir ruta para “{record.producto}”</h1>
            <p>Define cómo continúa el requerimiento y notifica a Documentación Técnica.</p>
          </div>
        </div>

        <motion.form
          className="card new-record-step2"
          onSubmit={handleEnviarARevision}
          variants={cardEntrance}
          initial="initial"
          animate="animate"
        >
          <div className="form-field">
            <label>Ruta del requerimiento</label>
            <div className="route-options" role="radiogroup" aria-label="Ruta del requerimiento">
              {TIPOS_FLUJO.map((t) => (
                <motion.button
                  type="button"
                  key={t}
                  role="radio"
                  aria-checked={tipoFlujo === t}
                  className={`route-card${tipoFlujo === t ? " selected" : ""}`}
                  onClick={() => setTipoFlujo(t)}
                  {...pressable}
                >
                  {/* El borde de selección se desliza entre las dos opciones. */}
                  {tipoFlujo === t && (
                    <motion.span className="route-card-ring" layoutId="route-selected" transition={springBouncy} />
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
              value={destinatarios}
              onChange={setDestinatarios}
              suggestions={directorio.map((u) => u.email)}
              placeholder="Escribe un correo y presiona Enter…"
            />
            <span className="hint">Se prellenó con todos los usuarios; quita a quien no corresponda notificar.</span>
          </div>

          <FormMessage>{error}</FormMessage>

          <div className="form-actions">
            <motion.button
              className="btn btn-primary"
              type="submit"
              disabled={!tipoFlujo || destinatarios.length === 0 || loading}
              {...pressable}
            >
              {loading && <Spinner />}
              {loading ? "Enviando…" : "Enviar a Documentación Técnica"}
            </motion.button>
          </div>
        </motion.form>
      </div>
    );
  }

  // --- Paso 1 ---
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Nuevo requerimiento</h1>
          <p>Ingresa los datos base del producto a conciliar.</p>
        </div>
      </div>

      <form className="card" onSubmit={handleCrear}>
        <div className="form-section">
          <h2 className="form-section-title">Producto</h2>
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
              <label htmlFor="codigoProducto">Cód. Producto</label>
              <div className="field-glow">
                <input id="codigoProducto" type="text" value={codigoProducto} onChange={(e) => setCodigoProducto(e.target.value)} />
              </div>
            </div>
            <div className="form-field field-compact">
              <label htmlFor="planta">Planta</label>
              <div className="field-glow">
                <select id="planta" value={planta} onChange={(e) => setPlanta(e.target.value)} required>
                  <option value="1">1</option>
                  <option value="2">2</option>
                </select>
              </div>
            </div>
            <div className="form-field span-2">
              <label htmlFor="producto">Producto</label>
              <div className="field-glow">
                <input id="producto" type="text" value={producto} onChange={(e) => setProducto(e.target.value)} required />
              </div>
            </div>
          </div>

          <FormMessage tone="warning">
            {duplicados.length > 0 ? (
              <>
                <strong>
                  {duplicados.length === 1
                    ? "Ya existe una conciliación activa para este producto:"
                    : `Ya existen ${duplicados.length} conciliaciones activas para este producto:`}
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
        </div>

        <div className="form-section">
          <h2 className="form-section-title">Detalle de la conciliación</h2>
          <div className="form-grid">
            <div className="form-field span-2 field-compact">
              <label htmlFor="fecha">Fecha de conciliación</label>
              <div className="field-glow">
                <input
                  id="fecha"
                  type="date"
                  value={fechaConciliacion}
                  onChange={(e) => setFechaConciliacion(e.target.value)}
                  required
                />
              </div>
              <span className="hint">Por defecto, la fecha de hoy.</span>
            </div>

            <div className="form-field span-2">
              <label htmlFor="motivo">Motivo de conciliación</label>
              <div className="field-glow">
                <AutoResizeTextarea
                  id="motivo"
                  value={motivoConciliacion}
                  onChange={(e) => setMotivoConciliacion(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-field span-2">
              <label htmlFor="materiales">Materiales a conciliar</label>
              <div className="field-glow">
                <AutoResizeTextarea
                  id="materiales"
                  value={materialesAConciliar}
                  onChange={(e) => setMaterialesAConciliar(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-field span-2">
              <label htmlFor="regulatorios">Asuntos regulatorios</label>
              <div className="field-glow">
                <AutoResizeTextarea
                  id="regulatorios"
                  value={asuntosRegulatorios}
                  onChange={(e) => setAsuntosRegulatorios(e.target.value)}
                  placeholder="Opcional: observaciones o requisitos regulatorios asociados"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2 className="form-section-title">Recetas a conciliar</h2>
          <RecetasConciliarSection
            items={listasConciliar}
            onAdd={(item: NuevaReceta) =>
              setListasConciliar((prev) => [...prev, { ...item, id: crypto.randomUUID() }])
            }
            onRemove={(id) => setListasConciliar((prev) => prev.filter((i) => i.id !== id))}
          />
        </div>

        <FormMessage>{error}</FormMessage>

        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading && <Spinner />}
            {loading ? "Guardando…" : "Guardar y continuar"}
          </button>
        </div>
      </form>
    </div>
  );
}
