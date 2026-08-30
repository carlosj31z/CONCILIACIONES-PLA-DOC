import type { Transition, Variants } from "framer-motion";

/**
 * Vocabulario de movimiento compartido por toda la app.
 *
 * La idea es que TODA animación salga de acá, para que el ritmo se sienta
 * como un solo sistema y no como efectos sueltos por página. Dos reglas
 * que se respetan en todos los presets:
 *
 * 1. Nada dura más de ~350 ms. Esto es una herramienta de trabajo diario:
 *    la animación tiene que confirmar lo que pasó, nunca hacerte esperar.
 * 2. Solo se animan `transform` y `opacity` (nunca `width`, `top`, etc.),
 *    que es lo único que el navegador puede componer en la GPU sin
 *    recalcular layout en cada frame.
 *
 * El respeto por `prefers-reduced-motion` NO se maneja acá sino con
 * <MotionConfig reducedMotion="user"> en main.tsx: framer-motion entonces
 * ignora los cambios de transform/opacity de estos presets y deja solo los
 * de opacidad, sin que cada componente tenga que preguntarlo.
 */

/** Salida estándar: rápida al inicio, suave al final. Para casi todo. */
export const easeOut: Transition["ease"] = [0.22, 0.9, 0.32, 1];

/** Spring corto y sin rebote perceptible: menús, popovers, elementos que "aparecen". */
export const springSoft: Transition = { type: "spring", stiffness: 460, damping: 34, mass: 0.9 };

/** Spring con un toque de rebote: indicadores que se mueven entre posiciones. */
export const springBouncy: Transition = { type: "spring", stiffness: 520, damping: 30, mass: 0.8 };

/** Transición de página: apenas un desplazamiento, para no marear al navegar. */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.26, ease: easeOut } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.16, ease: easeOut } },
};

/**
 * Contenedor de lista con entrada escalonada (filas de tabla, tarjetas del
 * panel, resultados de búsqueda). `staggerChildren` chico a propósito: con
 * 20+ filas, un stagger de 60 ms haría que la última tarde más de un
 * segundo en aparecer. `delayChildren` deja que el contenedor asiente
 * primero.
 */
export const listContainer: Variants = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.028, delayChildren: 0.04 },
  },
};

/** Ítem de una lista escalonada. Se usa junto con `listContainer`. */
export const listItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: easeOut } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.14, ease: easeOut } },
};

/** Entrada de una tarjeta/sección suelta (no dentro de una lista escalonada). */
export const cardEntrance: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: easeOut } },
};

/** Panel que se despliega hacia abajo: menús, resultados de búsqueda, popovers. */
export const popVariants: Variants = {
  initial: { opacity: 0, y: -6, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: springSoft },
  exit: { opacity: 0, y: -4, scale: 0.99, transition: { duration: 0.12, ease: easeOut } },
};

/** Bloque que aparece/desaparece midiendo su propia altura (avisos, banners). */
export const collapseVariants: Variants = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: "auto", transition: { duration: 0.24, ease: easeOut } },
  exit: { opacity: 0, height: 0, transition: { duration: 0.16, ease: easeOut } },
};

/** Feedback táctil compartido por botones y filas clickeables. */
export const pressable = {
  whileTap: { scale: 0.975 },
  transition: springSoft,
} as const;
