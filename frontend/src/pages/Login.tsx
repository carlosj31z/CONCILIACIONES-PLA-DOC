import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";
import { Spinner } from "../components/Spinner";
import humanovaLogo from "../assets/humanova-logo.png";

// Motivo decorativo tipo "red de datos + hélice": sustituye a un video de
// fondo (no se pudo descargar ningún clip de stock desde este entorno, ver
// nota en el README) sin depender de ningún archivo externo. Nodos y hélice
// fijos a propósito — solo se anima opacidad/transform, nunca se recalculan
// posiciones en cada render.
const NODOS = [
  [40, 60], [140, 30], [230, 90], [320, 40], [80, 150], [200, 180],
  [340, 160], [120, 250], [280, 260], [50, 320], [220, 340], [350, 300],
] as const;

const ENLACES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [0, 4], [1, 5], [2, 5], [3, 6], [4, 7], [5, 8],
  [6, 8], [7, 9], [7, 10], [8, 11], [9, 10], [10, 11],
];

function BioDataMotif() {
  return (
    <svg className="login-motif" viewBox="0 0 380 380" fill="none" aria-hidden="true">
      <g className="login-motif-net" stroke="#8fb3ff" strokeWidth="1">
        {ENLACES.map(([a, b], i) => (
          <line key={i} x1={NODOS[a][0]} y1={NODOS[a][1]} x2={NODOS[b][0]} y2={NODOS[b][1]} />
        ))}
        {NODOS.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 4 : 2.5} fill="#8fb3ff" stroke="none" />
        ))}
      </g>
      <g className="login-motif-helix" stroke="#b48bff" strokeWidth="1.6" strokeLinecap="round">
        <path d="M300 0 C 260 40, 340 80, 300 120 S 260 200, 300 240 S 340 320, 300 360" />
        <path d="M340 0 C 380 40, 300 80, 340 120 S 380 200, 340 240 S 300 320, 340 360" />
        {Array.from({ length: 9 }).map((_, i) => {
          const y = i * 45;
          const t = (y % 120) / 120;
          const left = 300 + Math.sin(t * Math.PI * 2) * 40;
          const right = 340 - Math.sin(t * Math.PI * 2) * 40;
          return <line key={i} x1={left} y1={y} x2={right} y2={y} strokeWidth="1" opacity="0.7" />;
        })}
      </g>
    </svg>
  );
}

export function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      <div className="login-brand">
        <BioDataMotif />
        <div className="login-brand-content">
          <div className="login-mark" aria-hidden="true">
            RC
          </div>
          <h1>Recetas de Conciliación</h1>
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
    </div>
  );
}
