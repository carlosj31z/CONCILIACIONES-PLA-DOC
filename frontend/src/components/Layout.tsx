import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABELS } from "../types";

const navLinkClass = ({ isActive }: { isActive: boolean }) => (isActive ? "active" : undefined);

function saludoSegunHora(): string {
  const hora = new Date().getHours();
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  const primeras = partes.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return primeras.join("") || "?";
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const primerNombre = user?.nombre.split(" ")[0];

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">RC</span>
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
          {user?.role === "ADMIN" && (
            <>
              <div className="nav-divider" />
              <NavLink to="/usuarios" className={navLinkClass}>
                Usuarios
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-user-row">
            <span className="user-avatar">{user ? iniciales(user.nombre) : ""}</span>
            <div>
              <div className="sidebar-user-name">{user?.nombre}</div>
              <span className="role">{user ? ROLE_LABELS[user.role] : ""}</span>
            </div>
          </div>
          <button onClick={logout}>Cerrar sesión</button>
        </div>
      </aside>
      <main className="main">
        {primerNombre && (
          <div className="greeting-bar">
            {saludoSegunHora()}, {primerNombre}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
