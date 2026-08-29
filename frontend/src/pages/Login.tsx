import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";
import { Spinner } from "../components/Spinner";

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
        <div className="login-mark" aria-hidden="true">
          RC
        </div>
        <h1>Recetas de Conciliación</h1>
        <p>Un flujo claro entre Planeamiento y Documentación Técnica, con estado y trazabilidad en cada paso.</p>
        <div className="login-roles">
          <span className="login-role-pill">Planeamiento</span>
          <span className="login-role-pill">Documentación Técnica</span>
        </div>
      </div>

      <div className="login-form-panel">
        <form className="login-card" onSubmit={handleSubmit}>
          <h2>Ingresar</h2>
          <p>Escribe tu correo institucional. No necesitas contraseña.</p>

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
