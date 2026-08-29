import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ROLE_LABEL: Record<string, string> = {
  PLANEAMIENTO: "Planeamiento",
  DOC_TECNICA: "Documentación Técnica",
  ADMIN: "Administrador",
};

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">Recetas de Conciliación</div>
        <div className="sidebar-subtitle">Planeamiento · Documentación Técnica</div>

        <nav className="sidebar-nav">
          <Link to="/">Tablero de registros</Link>
          {(user?.role === "PLANEAMIENTO" || user?.role === "ADMIN") && (
            <Link to="/registros/nuevo">+ Nuevo requerimiento</Link>
          )}
        </nav>

        <div className="sidebar-user">
          <div>{user?.nombre}</div>
          <span className="role">{user ? ROLE_LABEL[user.role] : ""}</span>
          <button onClick={logout}>Cerrar sesión</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
