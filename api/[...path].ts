// Función serverless de Vercel que envuelve toda la API Express existente.
// Vercel enruta cualquier request bajo /api/** a este archivo (por su nombre
// de catch-all) y le pasa el request/response originales; como una app de
// Express es en sí misma un manejador (req, res) => void, basta con
// reexportarla — ella hace su propio ruteo interno (/api/auth, /api/records,
// /api/cron, /api/health), sin necesitar ningún adaptador adicional.
import { app } from "../backend/src/app";

export default app;
