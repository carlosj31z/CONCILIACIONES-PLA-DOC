import express from "express";
import cors from "cors";
import { config } from "./config";
import { errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./routes/auth.routes";
import { recordsRouter } from "./routes/records.routes";

export const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRouter);
app.use("/api/records", recordsRouter);

app.use(errorHandler);
