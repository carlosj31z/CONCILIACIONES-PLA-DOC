import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import {
  CaretDoubleLeft,
  CaretDoubleRight,
  FilePlus,
  ListChecks,
  SignOut,
  SquaresFour,
  Users,
  type Icon,
} from "@phosphor-icons/react";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABELS } from "../types";
import humanovaMark from "../assets/humanova-mark.jpg";

const navLinkClass = ({ isActive }: { isActive: boolean }) => (isActive ? "active" : undefined);
const SIDEBAR_COLLAPSED_KEY = "sidebar_collapsed";

interface NavItem {
  to: string;
  end?: boolean;
  label: string;
  shortLabel: string;
  Icon: Icon;
  divider?: boolean;
}

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
  const puedeCrear = user?.role === "PLANEAMIENTO" || user?.role === "ADMIN";
  const esAdmin = user?.role === "ADMIN";
  const [colapsado, setColapsado] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [menuAbierto, setMenuAbierto] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, colapsado ? "1" : "0");
    } catch {
      // localStorage no disponible (modo privado, etc.): no persiste, no rompe la app.
    }
  }, [colapsado]);

  useEffect(() => {
    if (!menuAbierto) return;
    function onOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setMenuAbierto(false);
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuAbierto(false);
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [menuAbierto]);

  const navItems: NavItem[] = [
    { to: "/", end: true, label: "Seguimiento", shortLabel: "Registros", Icon: ListChecks },
    { to: "/panel", label: "Panel de actividades", shortLabel: "Panel", Icon: SquaresFour },
  ];
  if (puedeCrear) {
    navItems.push({ to: "/registros/nuevo", label: "Nuevo requerimiento", shortLabel: "Nuevo", Icon: FilePlus, divider: true });
  }
  if (esAdmin) {
    navItems.push({ to: "/usuarios", label: "Usuarios", shortLabel: "Usuarios", Icon: Users, divider: true });
  }

  return (
    <div className={`layout${colapsado ? " sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src={humanovaMark} alt="Humanova" className="brand-mark" />
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
          {navItems.map(({ to, end, label, Icon, divider }) => (
            <div key={to} className="sidebar-nav-item-wrap">
              {divider && <div className="nav-divider" />}
              <NavLink to={to} end={end} className={navLinkClass} title={label}>
                <Icon size={18} weight="bold" />
                <span className="sidebar-nav-label">{label}</span>
              </NavLink>
            </div>
          ))}
        </nav>

        <div className="sidebar-user" ref={userMenuRef}>
          <button
            type="button"
            className="user-avatar-btn"
            onClick={() => setMenuAbierto((v) => !v)}
            aria-haspopup="true"
            aria-expanded={menuAbierto}
            title={user?.nombre}
          >
            <span className="user-avatar">{user ? iniciales(user.nombre) : ""}</span>
            <span className="sidebar-nav-label sidebar-user-text">
              <span className="sidebar-user-name">{user?.nombre}</span>
              <span className="role">{user ? ROLE_LABELS[user.role] : ""}</span>
            </span>
          </button>
          <button className="sidebar-logout" onClick={logout} title="Cerrar sesión">
            <SignOut size={16} />
            <span className="sidebar-nav-label">Cerrar sesión</span>
          </button>

          {menuAbierto && (
            <div className="user-menu-popover" role="menu">
              <div className="user-menu-name">{user?.nombre}</div>
              <span className="role">{user ? ROLE_LABELS[user.role] : ""}</span>
              <button className="user-menu-logout" onClick={logout}>
                <SignOut size={16} />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </aside>

      <nav className="mobile-tabbar">
        {navItems.map(({ to, end, shortLabel, Icon }) => (
          <NavLink key={to} to={to} end={end} className={navLinkClass} title={shortLabel}>
            <Icon size={20} weight="bold" />
            <span>{shortLabel}</span>
          </NavLink>
        ))}
      </nav>

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
