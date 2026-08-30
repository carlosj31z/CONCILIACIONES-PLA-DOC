import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { pressable } from "../lib/motion";

/** Segundos antes de volver solo a la pantalla de inicio. */
const SEGUNDOS_REGRESO = 10;
const CANTIDAD_ESTRELLAS = 44;

/**
 * Posiciones fijas para las estrellas del fondo. Se calculan una sola vez con
 * un generador determinista (no Math.random) para que no salten en cada
 * re-render del contador: si cambiaran de sitio cada segundo, el fondo
 * parpadearía entero en vez de titilar.
 */
function useEstrellas() {
  return useMemo(() => {
    let semilla = 7;
    const siguiente = () => {
      semilla = (semilla * 1103515245 + 12345) % 2147483648;
      return semilla / 2147483648;
    };
    return Array.from({ length: CANTIDAD_ESTRELLAS }, () => ({
      izquierda: siguiente() * 100,
      arriba: siguiente() * 100,
      tamano: 1 + siguiente() * 2,
      retraso: siguiente() * 3,
      opacidad: 0.25 + siguiente() * 0.6,
    }));
  }, []);
}

function Astronauta() {
  return (
    <svg viewBox="0 0 200 230" role="img" aria-label="Astronauta a la deriva" className="nf-astronauta">
      {/* Cable de seguridad, cortado: el extremo suelto es lo que cuenta la historia. */}
      <path
        d="M104 150 C 130 176, 116 200, 148 214 C 160 219, 168 214, 172 208"
        className="nf-cable"
        fill="none"
      />
      <circle cx="173" cy="207" r="3.2" className="nf-cable-punta" />

      {/* Mochila */}
      <rect x="58" y="74" width="84" height="66" rx="16" className="nf-mochila" />

      {/* Brazos */}
      <rect x="30" y="84" width="34" height="17" rx="8.5" className="nf-traje" transform="rotate(-24 47 92)" />
      <rect x="136" y="84" width="34" height="17" rx="8.5" className="nf-traje" transform="rotate(24 153 92)" />

      {/* Piernas */}
      <rect x="70" y="132" width="19" height="46" rx="9.5" className="nf-traje" transform="rotate(-11 79 155)" />
      <rect x="111" y="132" width="19" height="46" rx="9.5" className="nf-traje" transform="rotate(11 120 155)" />

      {/* Torso */}
      <rect x="64" y="78" width="72" height="66" rx="22" className="nf-traje" />
      {/* Panel del pecho */}
      <rect x="84" y="99" width="32" height="22" rx="6" className="nf-panel" />
      <circle cx="93" cy="106" r="2.6" className="nf-led-verde" />
      <circle cx="102" cy="106" r="2.6" className="nf-led-ambar" />
      <circle cx="111" cy="106" r="2.6" className="nf-led-rojo" />
      <rect x="89" y="113" width="22" height="3" rx="1.5" className="nf-panel-linea" />

      {/* Casco */}
      <circle cx="100" cy="52" r="40" className="nf-casco" />
      <circle cx="100" cy="52" r="40" className="nf-casco-borde" fill="none" />
      {/* Visor */}
      <ellipse cx="100" cy="53" rx="30" ry="28" className="nf-visor" />
      {/* Reflejo del visor */}
      <path d="M80 40 C 88 32, 100 30, 108 34 C 96 38, 86 46, 82 58 Z" className="nf-reflejo" />
      <circle cx="116" cy="64" r="4" className="nf-reflejo-punto" />
    </svg>
  );
}

/**
 * Pantalla para una dirección que no existe. Aparece con una URL mal escrita
 * o con un enlace viejo; el caso frecuente —recargar estando dentro de la
 * app— lo resuelve el fallback de SPA (ver frontend/vercel.json y el plugin
 * `spaFallback404` de vite.config.ts), no esta pantalla.
 */
export function NotFound() {
  const navigate = useNavigate();
  const location = useLocation();
  const estrellas = useEstrellas();
  const reducirMovimiento = useReducedMotion();
  const [segundos, setSegundos] = useState(SEGUNDOS_REGRESO);

  useEffect(() => {
    if (segundos <= 0) {
      navigate("/", { replace: true });
      return;
    }
    const id = window.setTimeout(() => setSegundos((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [segundos, navigate]);

  const flotar = reducirMovimiento
    ? {}
    : {
        animate: { y: [0, -16, 0], rotate: [-4, 4, -4] },
        transition: { duration: 7, repeat: Infinity, ease: "easeInOut" as const },
      };

  return (
    <div className="nf-espacio">
      <div className="nf-estrellas" aria-hidden="true">
        {estrellas.map((e, i) => (
          <span
            key={i}
            className="nf-estrella"
            style={{
              left: `${e.izquierda}%`,
              top: `${e.arriba}%`,
              width: e.tamano,
              height: e.tamano,
              opacity: e.opacidad,
              animationDelay: `${e.retraso}s`,
            }}
          />
        ))}
      </div>

      {/* El planeta queda abajo a la izquierda: es "la base" de la que se alejó. */}
      <div className="nf-planeta" aria-hidden="true" />

      <div className="nf-contenido">
        <motion.div
          className="nf-astronauta-wrap"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 0.9, 0.32, 1] }}
        >
          <motion.div {...flotar}>
            <Astronauta />
          </motion.div>
        </motion.div>

        <motion.div
          className="nf-texto"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.12, ease: [0.22, 0.9, 0.32, 1] }}
        >
          <p className="nf-codigo">Error 404</p>
          <h1 className="nf-titulo">Perdimos contacto con esta página</h1>
          <p className="nf-bajada">
            Se soltó el cable y quedó fuera de órbita. La dirección{" "}
            <code className="nf-ruta">{location.pathname}</code> no existe en Conciliaciones.
          </p>

          <div className="nf-acciones">
            <motion.button className="btn btn-primary" onClick={() => navigate("/", { replace: true })} {...pressable}>
              Volver a la base
            </motion.button>
            <span className="hint nf-cuenta" role="status">
              Te llevamos de vuelta en {segundos} s
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
