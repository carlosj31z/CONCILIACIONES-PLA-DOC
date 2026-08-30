import { useEffect, useState } from "react";

/**
 * Suscribe a una media query de CSS desde React.
 *
 * Se usa para decidir ESTRUCTURA (p. ej. tabla en escritorio vs. tarjetas
 * en celular), no estilo: lo que se puede resolver con CSS debe resolverse
 * en CSS. Acá hace falta JS porque renderizar los dos árboles y ocultar uno
 * con `display:none` duplicaría cada fila en el DOM.
 *
 * El valor inicial se lee de forma síncrona (no en un efecto) para que el
 * primer render ya sea el correcto y no se vea la tabla un instante antes
 * de cambiar a tarjetas.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    // Re-sincroniza por si la query cambió entre el render y este efecto.
    setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Punto de corte único de la app para "celular"; coincide con global.css. */
export const MOBILE_QUERY = "(max-width: 760px)";
