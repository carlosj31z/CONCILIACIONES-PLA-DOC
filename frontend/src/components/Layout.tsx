import { useEffect, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import {
  CaretDoubleLeft,
  CaretDoubleRight,
  FilePlus,
  ListChecks,
  SignOut,
  SquaresFour,
  Users,
} from "@phosphor-icons/react";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABELS } from "../types";

const navLinkClass = ({ isActive }: { isActive: boolean }) => (isActive ? "active" : undefined);
const SIDEBAR_COLLAPSED_KEY = "sidebar_collapsed";

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
  const [colapsado, setColapsado] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, colapsado ? "1" : "0");
    } catch {
      // localStorage no disponible (modo privado, etc.): no persiste, no rompe la app.
    }
  }, [colapsado]);

  return (
    <div className={`layout${colapsado ? " sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">RC</span>
          <span className="sidebar-brand-text">Recetas de Conciliación</span>
        </div>
        <div className="sidebar-subtitle">Planeamiento · Documentación Técnica</div>

        <button
          className="sidebar-collapse-toggle"
          onClick={() => setColapsado((v) => !v)}
          title={colapsado ? "Expandir menú" : "Colapsar menú"}
        >
          {colapsado ? <CaretDoubleRight size={16} /> : <CaretDoubleLeft size={16} />}
          <span className="sidebar-nav-label">Colapsar menú</span>
        </button>

        <nav className="sidebar-nav">
          <NavLink to="/" end className={navLinkClass} title="Seguimiento">
            <ListChecks size={18} weight="bold" />
            <span className="sidebar-nav-label">Seguimiento</span>
          </NavLink>
          <NavLink to="/panel" className={navLinkClass} title="Panel de actividades">
            <SquaresFour size={18} weight="bold" />
            <span className="sidebar-nav-label">Panel de actividades</span>
          </NavLink>
          {(user?.role === "PLANEAMIENTO" || user?.role === "ADMIN") && (
            <>
              <div className="nav-divider" />
              <NavLink to="/registros/nuevo" className={navLinkClass} title="Nuevo requerimiento">
                <FilePlus size={18} weight="bold" />
                <span className="sidebar-nav-label">Nuevo requerimiento</span>
              </NavLink>
            </>
          )}
          {user?.role === "ADMIN" && (
            <>
              <div className="nav-divider" />
              <NavLink to="/usuarios" className={navLinkClass} title="Usuarios">
                <Users size={18} weight="bold" />
                <span className="sidebar-nav-label">Usuarios</span>
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-user-row">
            <span className="user-avatar" title={user?.nombre}>
              {user ? iniciales(user.nombre) : ""}
            </span>
            <div className="sidebar-nav-label">
              <div className="sidebar-user-name">{user?.nombre}</div>
              <span className="role">{user ? ROLE_LABELS[user.role] : ""}</span>
            </div>
          </div>
          <button className="sidebar-logout" onClick={logout} title="Cerrar sesión">
            <SignOut size={16} />
            <span className="sidebar-nav-label">Cerrar sesión</span>
          </button>
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
