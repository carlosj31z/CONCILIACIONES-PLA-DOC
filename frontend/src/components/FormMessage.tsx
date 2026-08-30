import { AnimatePresence, motion } from "framer-motion";
import { collapseVariants } from "../lib/motion";

interface FormMessageProps {
  /** Texto a mostrar; si es null/undefined/"" no se renderiza nada. */
  children: string | null | undefined;
  tone?: "error" | "hint";
}

/**
 * Mensaje de error o confirmación dentro de un formulario, que aparece y
 * desaparece animando su propia altura (en vez de saltar y empujar de golpe
 * los botones de abajo).
 *
 * Existe como componente porque el patrón se repetía ~8 veces en el detalle
 * del registro; centralizarlo también asegura que todos los errores lleven
 * role="alert", que es lo que hace que un lector de pantalla los anuncie
 * sin que el usuario tenga que ir a buscarlos.
 */
export function FormMessage({ children, tone = "error" }: FormMessageProps) {
  return (
    <AnimatePresence initial={false}>
      {children ? (
        <motion.div
          className={tone === "error" ? "form-error" : "hint"}
          role={tone === "error" ? "alert" : "status"}
          variants={collapseVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          // Al animar la altura, el texto tiene que quedar recortado dentro
          // del bloque; sin esto se desborda sobre lo de abajo mientras dura
          // la transición.
          style={{ overflow: "hidden" }}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
