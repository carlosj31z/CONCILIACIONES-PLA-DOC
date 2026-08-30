import { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "./context/AuthContext";
import { Layout } from "./components/Layout";
import { LoadingState } from "./components/Spinner";
import { pageVariants } from "./lib/motion";
import { Seguimiento } from "./pages/Seguimiento";

const CLAVE_RUTA_PENDIENTE = "conciliaciones_ruta_pendiente";

/**
 * Recarga una ruta profunda (ej. /registros/nuevo) → el backend responde con
 * una página que guarda esa dirección en sessionStorage y manda al
 * navegador a "/" (ver backend/src/app.ts). Al arrancar acá, si hay una
 * dirección guardada la retoma con el router — la persona termina exactamente
 * donde recargó, sin haber visto un 404 en el medio.
 */
function useRestaurarRutaProfunda() {
  const navigate = useNavigate();
  useEffect(() => {
    let pendiente: string | null = null;
    try {
      pendiente = sessionStorage.getItem(CLAVE_RUTA_PENDIENTE);
      if (pendiente) sessionStorage.removeItem(CLAVE_RUTA_PENDIENTE);
    } catch {
      pendiente = null;
    }
    const aqui = window.location.pathname + window.location.search;
    if (pendiente && pendiente !== aqui) navigate(pendiente, { replace: true });
    // Solo al montar: es una recuperación de un único salto, no algo que deba repetirse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * Seguimiento es la pantalla de entrada, así que va en el bundle principal.
 * El resto se carga bajo demanda: sin esto, todo usuario descarga también
 * el formulario de alta, el detalle y la administración de usuarios —
 * pantallas que en muchos casos no va a abrir (o que su rol ni siquiera le
 * permite ver).
 */
const Login = lazy(() => import("./pages/Login").then((m) => ({ default: m.Login })));
const Panel = lazy(() => import("./pages/Panel").then((m) => ({ default: m.Panel })));
const NewRecord = lazy(() => import("./pages/NewRecord").then((m) => ({ default: m.NewRecord })));
const RecordDetail = lazy(() => import("./pages/RecordDetail").then((m) => ({ default: m.RecordDetail })));
const Usuarios = lazy(() => import("./pages/Usuarios").then((m) => ({ default: m.Usuarios })));
const NotFound = lazy(() => import("./pages/NotFound").then((m) => ({ default: m.NotFound })));

function PrivateArea() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="app-loading"><LoadingState label="Cargando…" /></div>;
  if (!user) return <Navigate to="/login" replace />;

  const puedeCrear = user.role === "PLANEAMIENTO" || user.role === "ADMIN";

  return (
    <Layout>
      {/*
        El hijo directo de AnimatePresence tiene que ser el elemento animado
        y llevar la `key`: es así como detecta que una pantalla se fue y
        puede correr su animación de salida antes de desmontarla. Suspense va
        adentro, no afuera.

        `mode="wait"` deja que la pantalla anterior termine de salir antes de
        que entre la nueva: con "sync" las dos se superponen en el mismo
        lugar del layout y el contenido salta.
      */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <Suspense fallback={<div className="route-loading"><LoadingState label="Cargando…" /></div>}>
            <Routes location={location}>
              <Route path="/" element={<Seguimiento />} />
              <Route path="/panel" element={<Panel />} />
              <Route path="/registros/nuevo" element={puedeCrear ? <NewRecord /> : <Navigate to="/" replace />} />
              <Route path="/registros/:id" element={<RecordDetail />} />
              <Route path="/usuarios" element={user.role === "ADMIN" ? <Usuarios /> : <Navigate to="/" replace />} />
              {/* Antes redirigía en silencio al inicio; ahora explica qué pasó
                  (y vuelve solo al inicio a los 10 s). */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}

export function App() {
  useRestaurarRutaProfunda();

  return (
    <Suspense fallback={<div className="app-loading"><LoadingState label="Cargando…" /></div>}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<PrivateArea />} />
      </Routes>
    </Suspense>
  );
}
