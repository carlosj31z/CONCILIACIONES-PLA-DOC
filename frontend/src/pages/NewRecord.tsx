import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { EmailTagInput } from "../components/EmailTagInput";
import { MaterialLookup } from "../components/MaterialLookup";
import { RecetasConciliarSection, type NuevaReceta } from "../components/RecetasConciliarSection";
import { Spinner } from "../components/Spinner";
import { TIPO_FLUJO_LABELS, TIPOS_FLUJO, type ConciliationRecord, type DirectoryUser, type ListaConciliar, type TipoFlujo } from "../types";

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
      <div className="card" style={{ maxWidth: 520 }}>
        <h1 style={{ fontSize: 18, marginTop: 0 }}>Requerimiento enviado a revisión técnica</h1>
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
        <button className="btn btn-primary" onClick={() => navigate(`/registros/${record!.id}`)}>
          Ver registro
        </button>
      </div>
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

        <form className="card" style={{ maxWidth: 640 }} onSubmit={handleEnviarARevision}>
          <div className="form-field">
            <label>Ruta del requerimiento</label>
            <div className="route-options">
              {TIPOS_FLUJO.map((t) => (
                <div
                  key={t}
                  className={`route-card${tipoFlujo === t ? " selected" : ""}`}
                  onClick={() => setTipoFlujo(t)}
                >
                  <strong>{TIPO_FLUJO_LABELS[t]}</strong>
                  {t === "GENERAR_RECETA"
                    ? "Genera una nueva receta de conciliación de materiales."
                    : "Actualiza la receta existente sin pasar por conciliación."}
                </div>
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

          {error && <div className="form-error">{error}</div>}

          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={!tipoFlujo || destinatarios.length === 0 || loading}>
              {loading && <Spinner />}
              {loading ? "Enviando…" : "Enviar a Documentación Técnica"}
            </button>
          </div>
        </form>
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
            <input id="codigoProducto" type="text" value={codigoProducto} onChange={(e) => setCodigoProducto(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="planta">Planta</label>
            <select id="planta" value={planta} onChange={(e) => setPlanta(e.target.value)} required>
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
          </div>

          <div className="form-field span-2">
            <label htmlFor="producto">Producto</label>
            <input id="producto" type="text" value={producto} onChange={(e) => setProducto(e.target.value)} required />
          </div>

          <div className="form-field">
            <label htmlFor="fecha">Fecha de conciliación</label>
            <input
              id="fecha"
              type="date"
              value={fechaConciliacion}
              onChange={(e) => setFechaConciliacion(e.target.value)}
              required
            />
            <span className="hint">Por defecto, la fecha de hoy.</span>
          </div>

          <div className="form-field span-2">
            <label htmlFor="motivo">Motivo de conciliación</label>
            <textarea
              id="motivo"
              value={motivoConciliacion}
              onChange={(e) => setMotivoConciliacion(e.target.value)}
              required
            />
          </div>

          <div className="form-field span-2">
            <label htmlFor="materiales">Materiales a conciliar</label>
            <textarea
              id="materiales"
              value={materialesAConciliar}
              onChange={(e) => setMaterialesAConciliar(e.target.value)}
              required
            />
          </div>

          <div className="form-field span-2">
            <label>Recetas a conciliar</label>
            <RecetasConciliarSection
              items={listasConciliar}
              onAdd={(item: NuevaReceta) =>
                setListasConciliar((prev) => [...prev, { ...item, id: crypto.randomUUID() }])
              }
              onRemove={(id) => setListasConciliar((prev) => prev.filter((i) => i.id !== id))}
            />
          </div>

          <div className="form-field span-2">
            <label htmlFor="regulatorios">Asuntos regulatorios</label>
            <textarea
              id="regulatorios"
              value={asuntosRegulatorios}
              onChange={(e) => setAsuntosRegulatorios(e.target.value)}
              placeholder="Opcional: observaciones o requisitos regulatorios asociados"
            />
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

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
