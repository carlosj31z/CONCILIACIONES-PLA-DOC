import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { EmailTagInput } from "../components/EmailTagInput";
import { TIPO_FLUJO_LABELS, TIPOS_FLUJO, type ConciliationRecord, type TipoFlujo } from "../types";

const CORREOS_FRECUENTES = [
  "doctecnica@empresa.com",
  "calidad@empresa.com",
  "almacen@empresa.com",
  "regulatorios@empresa.com",
];

export function NewRecord() {
  const navigate = useNavigate();

  // Paso 1: datos base del requerimiento.
  const [codigoProducto, setCodigoProducto] = useState("");
  const [producto, setProducto] = useState("");
  const [planta, setPlanta] = useState("");
  const [fechaConciliacion, setFechaConciliacion] = useState("");
  const [motivoConciliacion, setMotivoConciliacion] = useState("");
  const [lotesTexto, setLotesTexto] = useState("");

  // Paso 2: decisión de flujo + notificación.
  const [record, setRecord] = useState<ConciliationRecord | null>(null);
  const [tipoFlujo, setTipoFlujo] = useState<TipoFlujo | null>(null);
  const [destinatarios, setDestinatarios] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function handleCrear(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const lotes = lotesTexto
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);

      const nuevo = await api.post<ConciliationRecord>("/records", {
        codigoProducto: codigoProducto || undefined,
        producto,
        planta,
        fechaConciliacion,
        motivoConciliacion,
        lotes,
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
      await api.post(`/records/${record.id}/decision`, { tipoFlujo, destinatarios });
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
        <p>
          Se notificó por correo a {destinatarios.length} destinatario(s). Documentación Técnica ya puede
          trabajar sobre este registro.
        </p>
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
              suggestions={CORREOS_FRECUENTES}
              placeholder="Escribe un correo y presiona Enter…"
            />
            <span className="hint">Recibirán el aviso de nuevo requerimiento en su bandeja de Outlook.</span>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={!tipoFlujo || destinatarios.length === 0 || loading}>
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
          <div className="form-field">
            <label htmlFor="codigoProducto">Cód. Producto</label>
            <input id="codigoProducto" type="text" value={codigoProducto} onChange={(e) => setCodigoProducto(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="planta">Planta</label>
            <input id="planta" type="text" placeholder="Ej. 1 YT" value={planta} onChange={(e) => setPlanta(e.target.value)} required />
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
          </div>
          <div className="form-field">
            <label htmlFor="lotes">Lotes (uno por línea o separados por coma)</label>
            <input id="lotes" type="text" placeholder="L001, L002" value={lotesTexto} onChange={(e) => setLotesTexto(e.target.value)} />
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
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Guardando…" : "Guardar y continuar"}
          </button>
        </div>
      </form>
    </div>
  );
}
