import express from "express";
import cors from "cors";
import { config } from "./config";
import { errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./routes/auth.routes";
import { recordsRouter } from "./routes/records.routes";
import { cronRouter } from "./routes/cron.routes";
import { usersRouter } from "./routes/users.routes";
import { materialesRouter } from "./routes/materiales.routes";

export const app = express();

// En Vercel, frontend y backend quedan en el mismo dominio (mismo proyecto),
// así que CORS no es estrictamente necesario; se deja habilitado igual para
// poder apuntar el frontend a otro dominio/backend sin tocar código.
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRouter);
app.use("/api/records", recordsRouter);
app.use("/api/cron", cronRouter);
app.use("/api/users", usersRouter);
app.use("/api/materiales", materialesRouter);

/*
  Cualquier dirección que no sea /api/* y que Vercel no haya podido resolver
  como archivo estático (todo lo que no sea /assets, /media, /favicon.png o
  la raíz "/") llega hasta acá: es una ruta de la SPA — /registros/nuevo,
  /panel, /registros/<id> — que alguien recargó directamente en el
  navegador. El servicio "frontend" solo sabe servir archivos que existen
  literalmente, así que no tiene qué devolverle a esta dirección.

  En vez de un 404, esta respuesta guarda a dónde se quería llegar y manda
  al navegador a "/", que sí sirve siempre el build real de la app; ahí el
  bootstrap de React (ver frontend/src/App.tsx, useRestaurarRutaProfunda)
  retoma esa dirección con el router, sin que la persona note más que un
  salto de pantalla. Se eligió este camino — por el backend, un servicio con
  código corriendo — en vez de intentarlo desde la configuración estática de
  Vercel porque ese otro camino, probado dos veces, no funcionó.
*/
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api")) return next();

  const destino = JSON.stringify(req.originalUrl).replace(/</g, "\\u003c");
  res.set("content-type", "text/html; charset=utf-8");
  res.send(`<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Conciliaciones</title>
  </head>
  <body>
    <script>
      try { sessionStorage.setItem("conciliaciones_ruta_pendiente", ${destino}); } catch (e) {}
      location.replace("/");
    </script>
    <noscript>
      <meta http-equiv="refresh" content="0; url=/" />
      <p>Redirigiendo… <a href="/">Ir al inicio</a></p>
    </noscript>
  </body>
</html>`);
});

app.use(errorHandler);
