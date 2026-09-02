import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../api/client";
import { listContainer, listItem, popVariants } from "../lib/motion";

interface MaterialResult {
  codigo: string;
  producto: string;
}

interface RespuestaMateriales {
  resultados: MaterialResult[];
  /** El backend llegó a su tope de filas: hay más coincidencias sin mostrar. */
  truncado: boolean;
}

interface MaterialLookupProps {
  onSelect: (material: MaterialResult) => void;
  /** Texto a mostrar de entrada (p. ej. el Producto ya elegido de un registro existente). */
  valorInicial?: string;
}

/**
 * Busca en el Maestro de Materiales de SAP (herramienta "SAP MM & LM"),
 * restringido a materiales tipo Producto Terminado (ZTER). Es la ÚNICA
 * forma de fijar el campo "Producto" del requerimiento: no hay un campo de
 * texto aparte para escribirlo a mano, así que el nombre que se guarda es
 * siempre el que trae SAP para el material elegido. El Cód. Producto, en
 * cambio, se escribe a mano por separado (ver NewRecord/RecordDetail):
 * la búsqueda solo ayuda a encontrar el producto, no fija su código.
 *
 * Al elegir un resultado, la propia casilla de búsqueda pasa a mostrar el
 * nombre elegido (en vez de vaciarse) para que quede a la vista qué
 * producto quedó seleccionado.
 */
export function MaterialLookup({ onSelect, valorInicial }: MaterialLookupProps) {
  const [q, setQ] = useState(valorInicial ?? "");
  const [resultados, setResultados] = useState<MaterialResult[]>([]);
  const [truncado, setTruncado] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
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
        .get<RespuestaMateriales>(`/materiales/buscar?q=${encodeURIComponent(query)}`)
        .then((r) => {
          setResultados(r.resultados);
          setTruncado(r.truncado);
          setAbierto(true);
        })
        .catch(() => {
          setResultados([]);
          setTruncado(false);
          setError("No se pudo consultar el Maestro de Materiales de SAP en este momento.");
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

  function elegir(r: MaterialResult) {
    onSelect(r);
    setQ(r.producto);
    setResultados([]);
    setAbierto(false);
  }

  return (
    <div className="material-lookup" ref={wrapRef}>
      <div className="field-glow">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => resultados.length > 0 && setAbierto(true)}
          placeholder="Buscar producto terminado en el Maestro de Materiales de SAP…"
        />
      </div>
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
              <div className="material-lookup-msg">Sin productos terminados que coincidan en el Maestro de Materiales.</div>
            )}
            {!buscando && resultados.length > 0 && (
              <div className="material-lookup-conteo">
                {resultados.length === 1 ? "1 producto" : `${resultados.length} productos`}
                {truncado && " · afina el texto para ver el resto"}
              </div>
            )}
            {!buscando && resultados.length > 0 && (
              <motion.div variants={listContainer} initial="initial" animate="animate">
                {resultados.map((r) => (
                  <motion.button
                    type="button"
                    key={r.codigo}
                    className="material-lookup-option"
                    onClick={() => elegir(r)}
                    variants={listItem}
                  >
                    <span className="material-lookup-code">{r.codigo}</span>
                    <span className="material-lookup-name">{r.producto || "Sin descripción"}</span>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
