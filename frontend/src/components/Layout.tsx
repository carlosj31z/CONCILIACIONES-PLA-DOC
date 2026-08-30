import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
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
import { popVariants, pressable, springBouncy } from "../lib/motion";
import { ROLE_LABELS } from "../types";
import humanovaMark from "../assets/humanova-mark.png";

const navLinkClass = ({ isActive }: { isActive: boolean }) => (isActive ? "active" : undefined);
const SIDEBAR_COLLAPSED_KEY = "sidebar_collapsed";

/** Rutas donde el saludo aporta (pantallas "de inicio"), no en formularios ni detalle. */
const RUTAS_CON_SALUDO = ["/", "/panel"];

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
  const location = useLocation();
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

  // El saludo solo tiene sentido al "llegar" a la app. Sobre el detalle de un
  // registro o un formulario es ruido que empuja el contenido hacia abajo —
  // caro sobre todo en celular.
  const mostrarSaludo = Boolean(primerNombre) && RUTAS_CON_SALUDO.includes(location.pathname);

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

  // Al navegar se cierra el menú de usuario: si no, queda abierto flotando
  // sobre la pantalla nueva.
  useEffect(() => setMenuAbierto(false), [location.pathname]);

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
          <img src={humanovaMark} alt="Humanova" className="brand-mark" width={28} height={28} />
          <span className="sidebar-brand-text">Conciliaciones</span>
        </div>
        {/* Abreviado: "Documentación Técnica" completo no entra en los 240px
            del sidebar y quedaba cortado a media palabra. */}
        <div className="sidebar-subtitle">Planeamiento · Doc. Técnica</div>

        <motion.button
          className="sidebar-collapse-toggle"
          onClick={() => setColapsado((v) => !v)}
          title={colapsado ? "Expandir menú" : "Colapsar menú"}
          aria-expanded={!colapsado}
          {...pressable}
        >
          {/* El ícono gira en vez de intercambiarse de golpe. */}
          <motion.span
            className="sidebar-collapse-icon"
            animate={{ rotate: colapsado ? 180 : 0 }}
            transition={springBouncy}
          >
            {colapsado ? <CaretDoubleRight size={16} /> : <CaretDoubleLeft size={16} />}
          </motion.span>
          <span className="sidebar-nav-label">Colapsar menú</span>
        </motion.button>

        <nav className="sidebar-nav">
          {navItems.map(({ to, end, label, Icon, divider }) => (
            <div key={to} className="sidebar-nav-item-wrap">
              {divider && <div className="nav-divider" />}
              <NavLink to={to} end={end} className={navLinkClass} title={label}>
                {({ isActive }) => (
                  <>
                    {/*
                      layoutId hace que el fondo del ítem activo se DESPLACE
                      de una opción a otra en vez de apagarse acá y prenderse
                      allá: es lo que conecta visualmente "de dónde vengo" con
                      "a dónde voy".
                    */}
                    {isActive && (
                      <motion.span className="nav-active-bg" layoutId="sidebar-active" transition={springBouncy} />
                    )}
                    <Icon size={18} weight="bold" />
                    <span className="sidebar-nav-label">{label}</span>
                  </>
                )}
              </NavLink>
            </div>
          ))}
        </nav>

        <div className="sidebar-user" ref={userMenuRef}>
          <motion.button
            type="button"
            className="user-avatar-btn"
            onClick={() => setMenuAbierto((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuAbierto}
            aria-label={`Menú de ${user?.nombre ?? "usuario"}`}
            title={user?.nombre}
            {...pressable}
          >
            <span className="user-avatar">{user ? iniciales(user.nombre) : ""}</span>
            <span className="sidebar-nav-label sidebar-user-text">
              <span className="sidebar-user-name">{user?.nombre}</span>
              <span className="role">{user ? ROLE_LABELS[user.role] : ""}</span>
            </span>
          </motion.button>
          <motion.button className="sidebar-logout" onClick={logout} title="Cerrar sesión" {...pressable}>
            <SignOut size={16} />
            <span className="sidebar-nav-label">Cerrar sesión</span>
          </motion.button>

          <AnimatePresence>
            {menuAbierto && (
              <motion.div
                className="user-menu-popover"
                role="menu"
                variants={popVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <div className="user-menu-name">{user?.nombre}</div>
                <span className="role">{user ? ROLE_LABELS[user.role] : ""}</span>
                <button className="user-menu-logout" onClick={logout} role="menuitem">
                  <SignOut size={16} />
                  Cerrar sesión
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </aside>

      <nav className="mobile-tabbar" aria-label="Navegación principal">
        {navItems.map(({ to, end, shortLabel, Icon }) => (
          <NavLink key={to} to={to} end={end} className={navLinkClass} title={shortLabel}>
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span className="nav-active-bg" layoutId="tabbar-active" transition={springBouncy} />
                )}
                <Icon size={20} weight="bold" />
                <span>{shortLabel}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <main className="main">
        <AnimatePresence mode="wait">
          {mostrarSaludo && (
            <motion.div
              key="greeting"
              className="greeting-bar"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 0.9, 0.32, 1] }}
            >
              {saludoSegunHora()}, {primerNombre}
            </motion.div>
          )}
        </AnimatePresence>
        {children}
      </main>
    </div>
  );
}
