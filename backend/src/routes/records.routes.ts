import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  actualizarRegistro,
  actualizarRespuestaTecnica,
  agregarListaConciliar,
  buscarDuplicados,
  completarTarea,
  concluirRegistro,
  crearRegistro,
  decidirRuta,
  eliminarListaConciliar,
  eliminarRegistro,
  listarRegistros,
  obtenerRegistro,
  rechazarPlaneamiento,
  rechazarTecnica,
} from "../controllers/records.controller";

export const recordsRouter = Router();

recordsRouter.use(requireAuth);

recordsRouter.get("/", asyncHandler(listarRegistros));
// Antes de "/:id": si no, Express la confunde con un registro de id "duplicados".
recordsRouter.get("/duplicados", asyncHandler(buscarDuplicados));
recordsRouter.get("/:id", asyncHandler(obtenerRegistro));

// Planeamiento
recordsRouter.post("/", requireRole("PLANEAMIENTO", "ADMIN"), asyncHandler(crearRegistro));
recordsRouter.patch("/:id", requireRole("PLANEAMIENTO", "ADMIN"), asyncHandler(actualizarRegistro));
recordsRouter.delete("/:id", requireRole("PLANEAMIENTO", "ADMIN"), asyncHandler(eliminarRegistro));
recordsRouter.post(
  "/:id/listas-conciliar",
  requireRole("PLANEAMIENTO", "ADMIN"),
  asyncHandler(agregarListaConciliar)
);
recordsRouter.delete(
  "/:id/listas-conciliar/:listaId",
  requireRole("PLANEAMIENTO", "ADMIN"),
  asyncHandler(eliminarListaConciliar)
);
recordsRouter.post("/:id/decision", requireRole("PLANEAMIENTO", "ADMIN"), asyncHandler(decidirRuta));
recordsRouter.post("/:id/concluir", requireRole("PLANEAMIENTO", "ADMIN"), asyncHandler(concluirRegistro));
recordsRouter.post(
  "/:id/rechazar-planeamiento",
  requireRole("PLANEAMIENTO", "ADMIN"),
  asyncHandler(rechazarPlaneamiento)
);

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
recordsRouter.post(
  "/:id/rechazar-tecnica",
  requireRole("DOC_TECNICA", "ADMIN"),
  asyncHandler(rechazarTecnica)
);
