import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";
import { Spinner } from "../components/Spinner";
import { collapseVariants, easeOut, pressable } from "../lib/motion";
import humanovaMark from "../assets/humanova-mark.png";
import humanovaLogo from "../assets/humanova-logo.png";

/**
 * ¿Conviene descargar el video de fondo (~10 MB) para este visitante?
 *
 * Se omite si el sistema pide menos movimiento o si el navegador informa
 * ahorro de datos / conexión lenta — ahí queda el degradado del scrim, que
 * es un fondo válido por sí mismo. Se descarga igual en celular: es el
 * fondo de toda la pantalla de login, no solo detrás de la tarjeta.
 */
function debeCargarVideo(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;

  // API de información de red: no está en todos los navegadores, por eso el `any`.
  const conn = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (conn?.saveData) return false;
  if (conn?.effectiveType && ["slow-2g", "2g", "3g"].includes(conn.effectiveType)) return false;

  return true;
}

export function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Se decide una sola vez, después del primer render: así el formulario se
  // pinta de inmediato y el video nunca compite con él por el ancho de banda.
  const [cargarVideo, setCargarVideo] = useState(false);
  useEffect(() => {
    setCargarVideo(debeCargarVideo());
  }, []);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      {cargarVideo && (
        <motion.video
          ref={videoRef}
          className="login-bg-video"
          src="/media/dna-background.mp4"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
          // Aparece recién cuando hay imagen que mostrar, para que no haya un
          // rectángulo negro mientras el video todavía no decodifica.
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: easeOut }}
        />
      )}
      <div className="login-bg-scrim" aria-hidden="true" />

      <motion.div
        className="login-brand-header"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeOut }}
      >
        <img src={humanovaMark} alt="Humanova" className="login-mark" width={48} height={48} />
        <h1>Conciliaciones</h1>
      </motion.div>

      <div className="login-form-panel">
        <motion.form
          className="login-card"
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: easeOut, delay: 0.06 }}
        >
          <h2>Ingresar</h2>
          <p>Escribe tu correo institucional para continuar.</p>

          <div className="form-field">
            <label htmlFor="email">Correo</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@humanovalab.com"
              autoComplete="email"
              autoFocus
              required
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                className="form-error"
                role="alert"
                variants={collapseVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            className="btn btn-primary login-submit"
            type="submit"
            disabled={loading}
            {...pressable}
          >
            {loading && <Spinner />}
            {loading ? "Ingresando…" : "Ingresar"}
          </motion.button>
        </motion.form>
      </div>

      <motion.div
        className="login-brand-footer"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeOut, delay: 0.12 }}
      >
        <p>Un flujo claro entre Planeamiento y Documentación Técnica, con estado y trazabilidad en cada paso.</p>
        <div className="login-roles">
          <span className="login-role-pill">Planeamiento</span>
          <span className="login-role-pill">Documentación Técnica</span>
        </div>
        <div className="login-company">
          <span className="login-company-label">Parte de</span>
          <img src={humanovaLogo} alt="Humanova" className="login-company-logo" />
        </div>
      </motion.div>
    </div>
  );
}
