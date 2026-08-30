import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { App } from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      {/*
        reducedMotion="user" hace que framer-motion respete
        `prefers-reduced-motion` del sistema en TODA la app: desactiva los
        cambios de posición/escala y deja solo los de opacidad, sin que cada
        componente tenga que consultarlo por su cuenta.
      */}
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <App />
        </AuthProvider>
      </MotionConfig>
    </BrowserRouter>
  </React.StrictMode>
);
