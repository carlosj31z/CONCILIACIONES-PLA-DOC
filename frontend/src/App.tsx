import { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "./context/AuthContext";
import { Layout } from "./components/Layout";
import { LoadingState } from "./components/Spinner";
import { pageVariants } from "./lib/motion";
import { Seguimiento } from "./pages/Seguimiento";

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
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}

export function App() {
  return (
    <Suspense fallback={<div className="app-loading"><LoadingState label="Cargando…" /></div>}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<PrivateArea />} />
      </Routes>
    </Suspense>
  );
}
