import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
  // `vite preview` sirve el build de producción. Con el mismo proxy que el
  // servidor de desarrollo se puede probar el bundle real (carga diferida
  // de rutas incluida) contra el backend local, no solo el modo dev.
  preview: {
    port: 4173,
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
  build: {
    rollupOptions: {
      output: {
        /*
          Separa las dependencias del código de la app. Las librerías cambian
          pocas veces; el código propio, en cada despliegue. Al ir en archivos
          distintos, publicar una corrección de la app no invalida el caché
          del navegador para React/framer-motion/iconos, que es la parte
          pesada de la descarga.
        */
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-motion": ["framer-motion"],
          "vendor-icons": ["@phosphor-icons/react"],
        },
      },
    },
  },
});
