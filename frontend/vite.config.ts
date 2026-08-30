import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/*
  Red de seguridad para las direcciones que el hosting no encuentra.

  Esta app es una SPA: rutas como /registros/nuevo solo existen en el enrutador
  del navegador, no como archivos. Al recargarlas —o al cambiar entre modo
  escritorio y móvil, que recarga— un hosting puramente estático busca un
  archivo que no existe.

  El arreglo de verdad está en el backend (ver backend/src/app.ts): el
  vercel.json de la raíz manda ahí cualquier dirección que no sea /api,
  /assets, /media, el favicon o la raíz "/", y el backend responde con una
  página que guarda la dirección pedida y manda a "/", donde React la
  retoma. Se resolvió así, por un servicio con código corriendo, después de
  que intentarlo solo con reescrituras estáticas de Vercel no funcionara.

  Este 404.html es el plan B por si algo sirviera su propia página de "no
  encontrado" antes de llegar a esa lógica: guarda la dirección igual (mismo
  mecanismo que el backend) y manda al inicio, en vez de dejar a la persona
  en un error del que no puede salir.

  A propósito NO es una copia de index.html: si el fallback de arriba
  falla, copiar la app entera aquí volvería a depender de que el hosting lo
  sirva bien. Una página mínima que redirige no depende de nada.
*/
function spaFallback404(): Plugin {
  return {
    name: "spa-fallback-404",
    apply: "build",
    closeBundle() {
      const salida = resolve(__dirname, "dist");
      writeFileSync(resolve(salida, "404.html"), PAGINA_404, "utf8");
    },
  };
}

const PAGINA_404 = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Volviendo al inicio - Conciliaciones</title>
    <link rel="icon" type="image/png" href="/favicon.png" />
    <meta http-equiv="refresh" content="0; url=/" />
    <style>
      html, body { height: 100%; margin: 0; }
      body {
        display: grid;
        place-items: center;
        background: #0b1020;
        color: #e8ecf8;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        text-align: center;
        padding: 24px;
      }
      p { opacity: .7; font-size: 14px; }
      a { color: #b9d0ff; }
    </style>
  </head>
  <body>
    <div>
      <p>Perdimos la señal un momento. Te llevamos de vuelta al inicio…</p>
      <p><a href="/">Ir al inicio</a></p>
    </div>
    <script>
      // Mismo mecanismo que el backend (ver app.ts): guarda a dónde se
      // quería llegar antes de irse, así App.tsx la retoma al arrancar.
      try {
        sessionStorage.setItem(
          "conciliaciones_ruta_pendiente",
          window.location.pathname + window.location.search
        );
      } catch (e) {}
      // Si el navegador ignora el meta refresh (o lo bloquea dentro de un
      // iframe), esto lo fuerza igual. replace() para que el botón "atrás" no
      // devuelva a esta pantalla.
      window.location.replace("/");
    </script>
  </body>
</html>
`;

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
