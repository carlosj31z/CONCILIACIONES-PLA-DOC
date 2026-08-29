import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";

interface MaterialResult {
  codigo: string;
  producto: string;
  tipo: string;
  terminado: boolean;
}

interface MaterialLookupProps {
  onSelect: (material: MaterialResult) => void;
}

/**
 * Busca en el Maestro de Materiales de SAP (herramienta "SAP MM & LM") por
 * código o nombre de producto, para que Planeamiento pueda tomar el Cód.
 * Producto y el Producto directamente de SAP en vez de escribirlos a mano.
 * Es solo un atajo: al elegir un resultado se rellenan los campos de abajo,
 * que siguen siendo editables normalmente por si el código no existe en el
 * Maestro o hace falta ajustarlo.
 *
 * El Maestro trae de todo (producto terminado, materia prima, envase y
 * empaque…), pero acá casi siempre se busca un producto terminado — el
 * backend ya los prioriza; cuando aparece algo que no lo es, se etiqueta
 * con su tipo para que no se confunda con un producto terminado.
 */
export function MaterialLookup({ onSelect }: MaterialLookupProps) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<MaterialResult[]>([]);
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
        .get<MaterialResult[]>(`/materiales/buscar?q=${encodeURIComponent(query)}`)
        .then((r) => {
          setResultados(r);
          setAbierto(true);
        })
        .catch(() => {
          setResultados([]);
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
    setQ("");
    setResultados([]);
    setAbierto(false);
  }

  return (
    <div className="material-lookup" ref={wrapRef}>
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => resultados.length > 0 && setAbierto(true)}
        placeholder="Buscar código o nombre en el Maestro de Materiales de SAP…"
      />
      {abierto && (q.trim().length >= 2) && (
        <div className="material-lookup-panel">
          {buscando && <div className="material-lookup-msg">Buscando…</div>}
          {!buscando && error && <div className="material-lookup-msg material-lookup-error">{error}</div>}
          {!buscando && !error && resultados.length === 0 && (
            <div className="material-lookup-msg">Sin coincidencias en el Maestro de Materiales.</div>
          )}
          {!buscando &&
            resultados.map((r) => (
              <button type="button" key={r.codigo} className="material-lookup-option" onClick={() => elegir(r)}>
                <span className="material-lookup-code">{r.codigo}</span>
                <span className="material-lookup-name">
                  {r.producto || "Sin descripción"}
                  {!r.terminado && r.tipo && <span className="material-lookup-tag">{r.tipo}</span>}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
