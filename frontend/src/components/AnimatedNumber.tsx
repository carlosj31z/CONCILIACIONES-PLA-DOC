import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  /** Duración del conteo. Se acorta sola para números chicos. */
  duration?: number;
}

/**
 * Cuenta desde 0 hasta `value` al aparecer. Escribe directamente en el DOM
 * (`textContent`) en vez de con estado de React: son ~60 frames por
 * segundo, y pasarlos por el ciclo de render de React haría re-renderizar
 * la tarjeta entera en cada uno sin ningún beneficio visual.
 *
 * Con `prefers-reduced-motion` muestra el número final de una, sin contar.
 */
export function AnimatedNumber({ value, duration }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo) return;

    if (reduceMotion || value === 0) {
      nodo.textContent = String(value);
      return;
    }

    // Números chicos (lo normal acá: 0-20 registros) no necesitan casi nada
    // de tiempo; uno de 4 dígitos sí se beneficia de un conteo más largo.
    const dur = duration ?? Math.min(0.9, 0.35 + Math.log10(Math.max(value, 1)) * 0.22);

    const controls = animate(0, value, {
      duration: dur,
      ease: [0.22, 0.9, 0.32, 1],
      onUpdate: (v) => {
        nodo.textContent = Math.round(v).toLocaleString("es-PE");
      },
    });

    return () => controls.stop();
  }, [value, duration, reduceMotion]);

  // El valor inicial va en el HTML para que el número correcto exista aunque
  // el efecto todavía no haya corrido (primer paint, SSR, tests).
  return <span ref={ref}>{value.toLocaleString("es-PE")}</span>;
}
