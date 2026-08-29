import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { NewRecord } from "./pages/NewRecord";
import { RecordDetail } from "./pages/RecordDetail";

function PrivateArea() {
  const { user, loading } = useAuth();

  if (loading) return <div className="app-loading">Cargando…</div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/registros/nuevo" element={<NewRecord />} />
        <Route path="/registros/:id" element={<RecordDetail />} />
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
