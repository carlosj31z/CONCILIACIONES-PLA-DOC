import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../api/client";
import { Spinner } from "./Spinner";
import { collapseVariants, listContainer, listItem, popVariants, pressable } from "../lib/motion";
import type { ListaConciliar, OrigenListaConciliar } from "../types";

interface ListaSapResult {
  material: string;
  listaAlt: string;
  producto: string;
  centro: string;
  estado: string;
}

export type NuevaReceta = {
  origen: OrigenListaConciliar;
  material?: string;
  listaAlt?: string;
  producto?: string;
  centro?: string;
  estado?: string;
  descripcion?: string;
};

interface RecetasConciliarSectionProps {
  items: ListaConciliar[];
  onAdd: (item: NuevaReceta) => void | Promise<void>;
  onRemove: (id: string) => void | Promise<void>;
  /** Vista solo lectura: no muestra el buscador ni los botones de quitar. */
  disabled?: boolean;
}

function etiquetaItem(item: ListaConciliar | (NuevaReceta & { id?: string })): string {
  if (item.origen === "MANUAL") return item.descripcion || "—";
  const partes = [item.producto, `Lista ${item.listaAlt || "1"}`, item.centro, item.estado].filter(Boolean);
  return partes.join(" · ");
}

/**
 * Sección "Recetas a conciliar": busca listas de materiales (BOM) en SAP y
 * permite marcar cuáles se van a conciliar en este requerimiento, o agregar
 * una a mano cuando no está en el Maestro. `onAdd`/`onRemove` deciden si el
 * cambio es local (Nuevo requerimiento, antes de guardar) o inmediato contra
 * el backend (edición de un registro ya creado) — el componente no lo sabe.
 */
export function RecetasConciliarSection({ items, onAdd, onRemove, disabled }: RecetasConciliarSectionProps) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<ListaSapResult[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [agregandoKey, setAgregandoKey] = useState<string | null>(null);
  const [quitandoId, setQuitandoId] = useState<string | null>(null);
  const [mostrarManual, setMostrarManual] = useState(false);
  const [manualTexto, setManualTexto] = useState("");
  const [agregandoManual, setAgregandoManual] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResultados([]);
      setError(null);
      return;
    }
    setBuscando(true);
    setError(null);
    const timeout = setTimeout(() => {
      api
        .get<ListaSapResult[]>(`/materiales/listas?q=${encodeURIComponent(query)}`)
        .then((r) => {
          setResultados(r);
          setAbierto(true);
        })
        .catch(() => {
          setResultados([]);
          setError("No se pudo consultar el Maestro de Listas de Materiales de SAP en este momento.");
        })
        .finally(() => setBuscando(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [q]);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  function yaAgregada(r: ListaSapResult): boolean {
    return items.some((i) => i.origen === "SAP" && i.material === r.material && (i.listaAlt || "1") === (r.listaAlt || "1"));
  }

  async function agregarDeSap(r: ListaSapResult) {
    const key = `${r.material}-${r.listaAlt}`;
    setAgregandoKey(key);
    try {
      await onAdd({
        origen: "SAP",
        material: r.material,
        listaAlt: r.listaAlt,
        producto: r.producto,
        centro: r.centro,
        estado: r.estado,
      });
    } finally {
      setAgregandoKey(null);
    }
  }

  async function agregarManual() {
    if (manualTexto.trim().length < 2) return;
    setAgregandoManual(true);
    try {
      await onAdd({ origen: "MANUAL", descripcion: manualTexto.trim() });
      setManualTexto("");
      setMostrarManual(false);
    } finally {
      setAgregandoManual(false);
    }
  }

  async function quitar(id: string) {
    setQuitandoId(id);
    try {
      await onRemove(id);
    } finally {
      setQuitandoId(null);
    }
  }

  return (
    <div>
      {!disabled && (
        <div className="material-lookup" ref={wrapRef}>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => resultados.length > 0 && setAbierto(true)}
            // Corto a propósito: el texto largo se cortaba a media palabra en
            // celular, que se ve como un error. La explicación completa va en
            // el title y en el texto de ayuda debajo del campo.
            placeholder="Buscar producto o código…"
            title="Busca un producto en SAP para ver sus listas de materiales"
            aria-label="Buscar listas de materiales por producto o código"
          />
          <AnimatePresence>
            {abierto && q.trim().length >= 2 && (
              <motion.div
                className="material-lookup-panel"
                variants={popVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                {buscando && <div className="material-lookup-msg">Buscando…</div>}
                {!buscando && error && <div className="material-lookup-msg material-lookup-error">{error}</div>}
                {!buscando && !error && resultados.length === 0 && (
                  <div className="material-lookup-msg">Sin listas de materiales para esa búsqueda.</div>
                )}
                {!buscando && resultados.length > 0 && (
                  <motion.div variants={listContainer} initial="initial" animate="animate">
                    {resultados.map((r) => {
                      const key = `${r.material}-${r.listaAlt}`;
                      const agregada = yaAgregada(r);
                      return (
                        <motion.div className="material-lookup-option receta-option" key={key} variants={listItem}>
                          <div>
                            <span className="material-lookup-code">{r.material}</span>
                            <span className="material-lookup-name">
                              {etiquetaItem({
                                origen: "SAP",
                                producto: r.producto,
                                listaAlt: r.listaAlt,
                                centro: r.centro,
                                estado: r.estado,
                              })}
                            </span>
                          </div>
                          <motion.button
                            type="button"
                            className="btn btn-secondary receta-add-btn"
                            disabled={agregada || agregandoKey === key}
                            onClick={() => agregarDeSap(r)}
                            {...pressable}
                          >
                            {agregandoKey === key && <Spinner />}
                            {agregada ? "Agregada" : agregandoKey === key ? "Agregando…" : "Agregar"}
                          </motion.button>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {!disabled && (
        <div style={{ marginTop: 10 }}>
          <AnimatePresence mode="wait" initial={false}>
            {mostrarManual ? (
              <motion.div
                key="form"
                className="receta-manual-form"
                variants={collapseVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                style={{ overflow: "hidden" }}
              >
                <input
                  type="text"
                  value={manualTexto}
                  onChange={(e) => setManualTexto(e.target.value)}
                  placeholder="Describe la lista de materiales a mano…"
                  autoFocus
                />
                <motion.button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setMostrarManual(false)}
                  disabled={agregandoManual}
                  {...pressable}
                >
                  Cancelar
                </motion.button>
                <motion.button
                  type="button"
                  className="btn btn-primary"
                  onClick={agregarManual}
                  disabled={agregandoManual || manualTexto.trim().length < 2}
                  {...pressable}
                >
                  {agregandoManual && <Spinner />}
                  {agregandoManual ? "Agregando…" : "Agregar"}
                </motion.button>
              </motion.div>
            ) : (
              <motion.button
                key="toggle"
                type="button"
                className="btn btn-secondary"
                onClick={() => setMostrarManual(true)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                {...pressable}
              >
                + Agregar manualmente
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="receta-list">
        {items.length === 0 && (
          <p className="hint" style={{ margin: "10px 0 0" }}>
            Aún no se agregó ninguna lista de materiales.
          </p>
        )}
        {/* `popLayout` hace que, al quitar una receta, las de abajo suban
            deslizándose en vez de saltar de golpe al hueco. */}
        <AnimatePresence mode="popLayout" initial={false}>
          {items.map((item) => (
            <motion.div
              className="receta-item"
              key={item.id}
              layout
              variants={listItem}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <span className={`receta-tag receta-tag-${item.origen.toLowerCase()}`}>
                {item.origen === "SAP" ? "SAP" : "Manual"}
              </span>
              <span className="receta-item-label">{etiquetaItem(item)}</span>
              {!disabled && (
                <button
                  type="button"
                  className="receta-item-remove"
                  onClick={() => quitar(item.id)}
                  disabled={quitandoId === item.id}
                  aria-label="Quitar"
                  title="Quitar"
                >
                  {quitandoId === item.id ? "…" : "×"}
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
