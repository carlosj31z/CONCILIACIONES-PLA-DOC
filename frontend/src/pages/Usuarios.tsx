import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { api, ApiError } from "../api/client";
import { FormMessage } from "../components/FormMessage";
import { LoadingState, Spinner } from "../components/Spinner";
import { useAuth } from "../context/AuthContext";
import { listContainer, listItem } from "../lib/motion";
import { ROLES, ROLE_LABELS, type ManagedUser, type Role } from "../types";

export function Usuarios() {
  const { user: yo } = useAuth();
  const [usuarios, setUsuarios] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [puesto, setPuesto] = useState("");
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
      await api.post("/users", { nombre, email, role, puesto: puesto || undefined });
      setNombre("");
      setEmail("");
      setPuesto("");
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Usuarios</h1>
          <p>Alta y administración de cuentas de Planeamiento, Documentación Técnica y Admin. El acceso es solo con el correo, sin contraseña.</p>
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
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-field">
            <label htmlFor="puesto">Puesto</label>
            <input id="puesto" type="text" value={puesto} onChange={(e) => setPuesto(e.target.value)} placeholder="Ej. Analista de Documentación Técnica" />
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

        <FormMessage>{error}</FormMessage>

        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={creando}>
            {creando && <Spinner />}
            {creando ? "Creando…" : "+ Crear usuario"}
          </button>
        </div>
      </form>

      <div className="table-wrap">
        {loading ? (
          <div className="empty-state"><LoadingState label="Cargando usuarios…" /></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Puesto</th>
                <th>Rol</th>
                <th>Estado</th>
              </tr>
            </thead>
            <motion.tbody variants={listContainer} initial="initial" animate="animate">
              {usuarios.map((u) => {
                const esYoMismo = u.id === yo?.id;
                return (
                  <motion.tr key={u.id} variants={listItem} className="row-static">
                    <td className="producto-cell">{u.nombre}</td>
                    <td>{u.email}</td>
                    <td>{u.puesto ?? "—"}</td>
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
                        className="btn btn-secondary btn-compact"
                        disabled={esYoMismo}
                        title={esYoMismo ? "No puedes desactivar tu propia cuenta" : undefined}
                        onClick={() => alternarActivo(u)}
                      >
                        {u.activo ? "Activo — desactivar" : "Inactivo — activar"}
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </motion.tbody>
          </table>
        )}
      </div>
    </div>
  );
}
