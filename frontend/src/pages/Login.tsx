import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";
import { Spinner } from "../components/Spinner";
import humanovaMark from "../assets/humanova-mark.jpg";
import humanovaLogo from "../assets/humanova-logo.png";

export function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause();
    }
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
      <video
        ref={videoRef}
        className="login-bg-video"
        src="/media/dna-background.mp4"
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
      />
      <div className="login-bg-scrim" aria-hidden="true" />

      <div className="login-brand-header">
        <img src={humanovaMark} alt="Humanova" className="login-mark" />
        <h1>Conciliaciones</h1>
      </div>

      <div className="login-form-panel">
        <form className="login-card" onSubmit={handleSubmit}>
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
              autoFocus
              required
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%", justifyContent: "center" }}>
            {loading && <Spinner />}
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </div>

      <div className="login-brand-footer">
        <p>Un flujo claro entre Planeamiento y Documentación Técnica, con estado y trazabilidad en cada paso.</p>
        <div className="login-roles">
          <span className="login-role-pill">Planeamiento</span>
          <span className="login-role-pill">Documentación Técnica</span>
        </div>
        <div className="login-company">
          <span className="login-company-label">Parte de</span>
          <img src={humanovaLogo} alt="Humanova" className="login-company-logo" />
        </div>
      </div>
    </div>
  );
}
