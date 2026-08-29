import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  actualizarRespuestaTecnica,
  completarTarea,
  crearRegistro,
  decidirRuta,
  listarRegistros,
  obtenerRegistro,
} from "../controllers/records.controller";

export const recordsRouter = Router();

recordsRouter.use(requireAuth);

recordsRouter.get("/", asyncHandler(listarRegistros));
recordsRouter.get("/:id", asyncHandler(obtenerRegistro));

// Planeamiento
recordsRouter.post("/", requireRole("PLANEAMIENTO", "ADMIN"), asyncHandler(crearRegistro));
recordsRouter.post("/:id/decision", requireRole("PLANEAMIENTO", "ADMIN"), asyncHandler(decidirRuta));

// Documentación Técnica
recordsRouter.patch(
  "/:id/respuesta-tecnica",
  requireRole("DOC_TECNICA", "ADMIN"),
  asyncHandler(actualizarRespuestaTecnica)
);
recordsRouter.post(
  "/:id/completar",
  requireRole("DOC_TECNICA", "ADMIN"),
  asyncHandler(completarTarea)
);
