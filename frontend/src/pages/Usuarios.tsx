import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ROLES, ROLE_LABELS, type ManagedUser, type Role } from "../types";

export function Usuarios() {
  const { user: yo } = useAuth();
  const [usuarios, setUsuarios] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("PLANEAMIENTO");
  const [creando, setCreando] = useState(false);

  function cargar() {
    return api.get<ManagedUser[]>("/users").then(setUsuarios);
  }

  useEffect(() => {
    setLoading(true);
    cargar().finally(() => setLoading(false));
  }, []);

  async function handleCrear(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreando(true);
    try {
      await api.post("/users", { nombre, email, password, role });
      setNombre("");
      setEmail("");
      setPassword("");
      setRole("PLANEAMIENTO");
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear el usuario");
    } finally {
      setCreando(false);
    }
  }

  async function cambiarRole(u: ManagedUser, nuevoRole: Role) {
    setError(null);
    try {
      await api.patch(`/users/${u.id}`, { role: nuevoRole });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar el rol");
    }
  }

  async function alternarActivo(u: ManagedUser) {
    setError(null);
    try {
      await api.patch(`/users/${u.id}`, { activo: !u.activo });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar el estado");
    }
  }

  async function restablecerPassword(u: ManagedUser) {
    const nueva = window.prompt(`Nueva contraseña para ${u.email} (mínimo 8 caracteres):`);
    if (!nueva) return;
    setError(null);
    try {
      await api.patch(`/users/${u.id}`, { password: nueva });
      window.alert("Contraseña actualizada.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo restablecer la contraseña");
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Usuarios</h1>
          <p>Alta y administración de cuentas de Planeamiento, Documentación Técnica y Admin.</p>
        </div>
      </div>

      <form className="card" onSubmit={handleCrear} style={{ marginBottom: 24 }}>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="nombre">Nombre</label>
            <input id="nombre" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </div>
          <div className="form-field">
            <label htmlFor="email">Correo</label>
            <input id="email" type="text" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="role">Rol</label>
            <select id="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={creando}>
            {creando ? "Creando…" : "+ Crear usuario"}
          </button>
        </div>
      </form>

      <div className="table-wrap">
        {loading ? (
          <div className="empty-state">Cargando usuarios…</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Contraseña</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => {
                const esYoMismo = u.id === yo?.id;
                return (
                  <tr key={u.id} style={{ cursor: "default" }}>
                    <td className="producto-cell">{u.nombre}</td>
                    <td>{u.email}</td>
                    <td>
                      <select
                        value={u.role}
                        disabled={esYoMismo}
                        onChange={(e) => cambiarRole(u, e.target.value as Role)}
                        title={esYoMismo ? "No puedes cambiar tu propio rol" : undefined}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: "6px 12px", fontSize: 12 }}
                        disabled={esYoMismo}
                        title={esYoMismo ? "No puedes desactivar tu propia cuenta" : undefined}
                        onClick={() => alternarActivo(u)}
                      >
                        {u.activo ? "Activo — desactivar" : "Inactivo — activar"}
                      </button>
                    </td>
                    <td>
                      <button className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => restablecerPassword(u)}>
                        Restablecer
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
