import { copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Copia index.html a 404.html al terminar el build.
 *
 * Esta app es una SPA: rutas como /registros/nuevo solo existen en el
 * enrutador del navegador, no como archivos. Al recargar esa dirección (o al
 * cambiar entre modo escritorio y móvil, que recarga), el hosting busca un
 * archivo que no existe y responde con su propio 404 — y React ni siquiera
 * llega a arrancar, así que la pantalla 404 de la app tampoco se ve.
 *
 * El fallback correcto está en frontend/vercel.json. Este 404.html es la red
 * de seguridad: casi todos los hostings estáticos sirven ese archivo para las
 * rutas que no encuentran, y como su contenido es la app entera, React arranca
 * igual y el enrutador resuelve la dirección real.
 */
function spaFallback404(): Plugin {
  return {
    name: "spa-fallback-404",
    apply: "build",
    closeBundle() {
      const salida = resolve(__dirname, "dist");
      copyFileSync(resolve(salida, "index.html"), resolve(salida, "404.html"));
    },
  };
}

export default defineConfig({
  plugins: [react(), spaFallback404()],
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
