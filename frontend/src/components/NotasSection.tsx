import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeSlash, Paperclip, PencilSimple, Trash } from "@phosphor-icons/react";
import { api, ApiError } from "../api/client";
import { AutoResizeTextarea } from "./AutoResizeTextarea";
import { FormMessage } from "./FormMessage";
import { Spinner } from "./Spinner";
import { listItem, pressable } from "../lib/motion";
import type { NotaAdjunto, RecordNota, VisibilidadNota } from "../types";

/** Debe coincidir con TAMANO_MAXIMO_BYTES del backend. */
const MAXIMO_MB = 4;

function pesoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const esImagen = (tipo: string) => tipo.startsWith("image/");

/**
 * Miniatura o enlace de un adjunto. El enlace al archivo se pide al abrirlo
 * y no al listar: es temporal, y pedir uno por adjunto al cargar la página
 * sería una petición por archivo sin que nadie los haya mirado todavía.
 */
function Adjunto({
  notaId,
  adjunto,
  puedeEditar,
  onQuitar,
}: {
  notaId: string;
  adjunto: NotaAdjunto;
  puedeEditar: boolean;
  onQuitar: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  // Las imágenes se previsualizan, así que su enlace sí se pide de entrada.
  useEffect(() => {
    if (!esImagen(adjunto.tipo)) return;
    let vigente = true;
    api
      .get<{ url: string }>(`/records/notas/${notaId}/adjuntos/${adjunto.id}/enlace`)
      .then((r) => vigente && setUrl(r.url))
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [notaId, adjunto.id, adjunto.tipo]);

  async function abrir() {
    setCargando(true);
    try {
      const r = await api.get<{ url: string }>(`/records/notas/${notaId}/adjuntos/${adjunto.id}/enlace`);
      window.open(r.url, "_blank", "noopener,noreferrer");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className={esImagen(adjunto.tipo) ? "nota-adjunto nota-adjunto-imagen" : "nota-adjunto"}>
      {esImagen(adjunto.tipo) && url ? (
        <button type="button" className="nota-adjunto-miniatura" onClick={abrir} title={adjunto.nombre}>
          <img src={url} alt={adjunto.nombre} loading="lazy" />
        </button>
      ) : (
        <button type="button" className="nota-adjunto-archivo" onClick={abrir} disabled={cargando}>
          {cargando ? <Spinner /> : <Paperclip size={14} weight="bold" />}
          <span className="nota-adjunto-nombre">{adjunto.nombre}</span>
          <span className="nota-adjunto-peso">{pesoLegible(adjunto.tamano)}</span>
        </button>
      )}
      {puedeEditar && (
        <button type="button" className="nota-adjunto-quitar" onClick={onQuitar} aria-label={`Quitar ${adjunto.nombre}`}>
          ×
        </button>
      )}
    </div>
  );
}

function InsigniaVisibilidad({ visibilidad }: { visibilidad: VisibilidadNota }) {
  const privada = visibilidad === "PRIVADA";
  return (
    <span className={privada ? "nota-visibilidad nota-visibilidad-privada" : "nota-visibilidad"}>
      {privada ? <EyeSlash size={12} weight="bold" /> : <Eye size={12} weight="bold" />}
      {privada ? "Solo yo" : "Compartida"}
    </span>
  );
}

/**
 * Notas de un requerimiento: anotaciones que Planeamiento o Documentación
 * Técnica dejan sobre la conciliación, con imágenes y documentos adjuntos.
 *
 * Cada nota es de quien la escribió: solo esa persona ve los botones de
 * editar y borrar, y solo ella puede tocar los archivos. El backend lo
 * verifica igual — acá se ocultan para no ofrecer algo que va a fallar.
 */
export function NotasSection({ recordId }: { recordId: string }) {
  const [notas, setNotas] = useState<RecordNota[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [texto, setTexto] = useState("");
  const [visibilidad, setVisibilidad] = useState<VisibilidadNota>("COMPARTIDA");
  const [guardando, setGuardando] = useState(false);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [textoEditado, setTextoEditado] = useState("");
  const [subiendoEn, setSubiendoEn] = useState<string | null>(null);
  const archivoRef = useRef<HTMLInputElement>(null);
  const notaParaAdjuntar = useRef<string | null>(null);

  function cargar() {
    return api
      .get<RecordNota[]>(`/records/${recordId}/notas`)
      .then(setNotas)
      .catch(() => setError("No se pudieron cargar las notas."));
  }

  useEffect(() => {
    setCargando(true);
    cargar().finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);

  async function crear() {
    if (!texto.trim()) return;
    setError(null);
    setGuardando(true);
    try {
      await api.post(`/records/${recordId}/notas`, { contenido: texto.trim(), visibilidad });
      setTexto("");
      setVisibilidad("COMPARTIDA");
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar la nota");
    } finally {
      setGuardando(false);
    }
  }

  async function guardarEdicion(id: string) {
    if (!textoEditado.trim()) return;
    setError(null);
    try {
      await api.patch(`/records/notas/${id}`, { contenido: textoEditado.trim() });
      setEditandoId(null);
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el cambio");
    }
  }

  async function cambiarVisibilidad(nota: RecordNota) {
    setError(null);
    try {
      await api.patch(`/records/notas/${nota.id}`, {
        visibilidad: nota.visibilidad === "PRIVADA" ? "COMPARTIDA" : "PRIVADA",
      });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cambiar la visibilidad");
    }
  }

  async function borrar(id: string) {
    if (!confirm("¿Borrar esta nota y sus archivos? Esta acción no se puede deshacer.")) return;
    setError(null);
    try {
      await api.delete(`/records/notas/${id}`);
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo borrar la nota");
    }
  }

  function pedirArchivo(notaId: string) {
    notaParaAdjuntar.current = notaId;
    archivoRef.current?.click();
  }

  async function subirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    const notaId = notaParaAdjuntar.current;
    // El input se limpia siempre: si no, elegir el mismo archivo dos veces
    // seguidas no dispararía el evento la segunda vez.
    e.target.value = "";
    if (!archivo || !notaId) return;

    if (archivo.size > MAXIMO_MB * 1024 * 1024) {
      setError(`"${archivo.name}" pesa ${pesoLegible(archivo.size)}. El máximo es ${MAXIMO_MB} MB.`);
      return;
    }

    setError(null);
    setSubiendoEn(notaId);
    try {
      const q = `nombre=${encodeURIComponent(archivo.name)}&tipo=${encodeURIComponent(archivo.type)}`;
      await api.upload(`/records/notas/${notaId}/adjuntos?${q}`, archivo);
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo subir el archivo");
    } finally {
      setSubiendoEn(null);
    }
  }

  async function quitarAdjunto(notaId: string, adjuntoId: string) {
    setError(null);
    try {
      await api.delete(`/records/notas/${notaId}/adjuntos/${adjuntoId}`);
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo quitar el archivo");
    }
  }

  return (
    <div>
      <input ref={archivoRef} type="file" className="nota-input-archivo" onChange={subirArchivo} />

      <div className="nota-nueva">
        <div className="field-glow">
          <AutoResizeTextarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribe una anotación sobre esta conciliación…"
            aria-label="Nueva nota"
          />
        </div>
        <div className="nota-nueva-acciones">
          <label className="nota-visibilidad-selector">
            <input
              type="checkbox"
              checked={visibilidad === "PRIVADA"}
              onChange={(e) => setVisibilidad(e.target.checked ? "PRIVADA" : "COMPARTIDA")}
            />
            Solo para mí
          </label>
          <motion.button
            type="button"
            className="btn btn-primary btn-compact"
            onClick={crear}
            disabled={guardando || !texto.trim()}
            {...pressable}
          >
            {guardando && <Spinner />}
            {guardando ? "Guardando…" : "Agregar nota"}
          </motion.button>
        </div>
        <span className="hint">
          Las compartidas las ve cualquiera que abra el requerimiento; las privadas, solo tú. Los archivos se
          agregan después de crear la nota.
        </span>
      </div>

      <FormMessage>{error}</FormMessage>

      {cargando ? (
        <p className="hint">Cargando notas…</p>
      ) : notas.length === 0 ? (
        <p className="hint nota-vacia">Todavía no hay notas en este requerimiento.</p>
      ) : (
        <div className="nota-lista">
          <AnimatePresence mode="popLayout" initial={false}>
            {notas.map((nota) => (
              <motion.article
                key={nota.id}
                className={nota.visibilidad === "PRIVADA" ? "nota nota-privada" : "nota"}
                layout
                variants={listItem}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <header className="nota-cabecera">
                  <span className="nota-autor">{nota.esMia ? "Tú" : nota.autor.nombre}</span>
                  <InsigniaVisibilidad visibilidad={nota.visibilidad} />
                  <time className="hint nota-fecha" dateTime={nota.createdAt}>
                    {new Date(nota.createdAt).toLocaleString("es-PE")}
                    {nota.updatedAt !== nota.createdAt && " · editada"}
                  </time>
                </header>

                {editandoId === nota.id ? (
                  <>
                    <div className="field-glow">
                      <AutoResizeTextarea
                        value={textoEditado}
                        onChange={(e) => setTextoEditado(e.target.value)}
                        aria-label="Editar nota"
                        autoFocus
                      />
                    </div>
                    <div className="nota-acciones">
                      <button className="btn btn-secondary btn-compact" onClick={() => setEditandoId(null)}>
                        Cancelar
                      </button>
                      <button className="btn btn-primary btn-compact" onClick={() => guardarEdicion(nota.id)}>
                        Guardar
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="nota-texto">{nota.contenido}</p>
                )}

                {nota.adjuntos.length > 0 && (
                  <div className="nota-adjuntos">
                    {nota.adjuntos.map((a) => (
                      <Adjunto
                        key={a.id}
                        notaId={nota.id}
                        adjunto={a}
                        puedeEditar={nota.esMia}
                        onQuitar={() => quitarAdjunto(nota.id, a.id)}
                      />
                    ))}
                  </div>
                )}

                {nota.esMia && editandoId !== nota.id && (
                  <div className="nota-acciones">
                    <button
                      className="btn btn-secondary btn-compact"
                      onClick={() => pedirArchivo(nota.id)}
                      disabled={subiendoEn === nota.id}
                    >
                      {subiendoEn === nota.id ? <Spinner /> : <Paperclip size={14} weight="bold" />}
                      {subiendoEn === nota.id ? "Subiendo…" : "Adjuntar archivo"}
                    </button>
                    <button
                      className="btn btn-secondary btn-compact"
                      onClick={() => {
                        setEditandoId(nota.id);
                        setTextoEditado(nota.contenido);
                      }}
                    >
                      <PencilSimple size={14} weight="bold" />
                      Editar
                    </button>
                    <button className="btn btn-secondary btn-compact" onClick={() => cambiarVisibilidad(nota)}>
                      {nota.visibilidad === "PRIVADA" ? <Eye size={14} weight="bold" /> : <EyeSlash size={14} weight="bold" />}
                      {nota.visibilidad === "PRIVADA" ? "Compartir" : "Hacer privada"}
                    </button>
                    <button className="btn btn-danger-ghost btn-compact" onClick={() => borrar(nota.id)}>
                      <Trash size={14} weight="bold" />
                      Borrar
                    </button>
                  </div>
                )}
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
