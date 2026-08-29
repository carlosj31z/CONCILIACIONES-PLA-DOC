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

app.use(errorHandler);
