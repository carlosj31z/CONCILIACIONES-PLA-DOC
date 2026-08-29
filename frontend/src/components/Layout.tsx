import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ROLE_LABEL: Record<string, string> = {
  PLANEAMIENTO: "Planeamiento",
  DOC_TECNICA: "Documentación Técnica",
  ADMIN: "Administrador",
};

const navLinkClass = ({ isActive }: { isActive: boolean }) => (isActive ? "active" : undefined);

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="logo-dot" />
          Recetas de Conciliación
        </div>
        <div className="sidebar-subtitle">Planeamiento · Documentación Técnica</div>

        <nav className="sidebar-nav">
          <NavLink to="/" end className={navLinkClass}>
            Seguimiento
          </NavLink>
          <NavLink to="/panel" className={navLinkClass}>
            Panel de actividades
          </NavLink>
          {(user?.role === "PLANEAMIENTO" || user?.role === "ADMIN") && (
            <>
              <div className="nav-divider" />
              <NavLink to="/registros/nuevo" className={navLinkClass}>
                + Nuevo requerimiento
              </NavLink>
            </>
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
