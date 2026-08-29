import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Seguimiento } from "./pages/Seguimiento";
import { Panel } from "./pages/Panel";
import { NewRecord } from "./pages/NewRecord";
import { RecordDetail } from "./pages/RecordDetail";
import { Usuarios } from "./pages/Usuarios";

function PrivateArea() {
  const { user, loading } = useAuth();

  if (loading) return <div className="app-loading">Cargando…</div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Seguimiento />} />
        <Route path="/panel" element={<Panel />} />
        <Route
          path="/registros/nuevo"
          element={user.role === "PLANEAMIENTO" || user.role === "ADMIN" ? <NewRecord /> : <Navigate to="/" replace />}
        />
        <Route path="/registros/:id" element={<RecordDetail />} />
        <Route path="/usuarios" element={user.role === "ADMIN" ? <Usuarios /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={<PrivateArea />} />
    </Routes>
  );
}
