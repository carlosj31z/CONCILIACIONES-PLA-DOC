import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { buscarMateriales } from "../controllers/materiales.controller";

export const materialesRouter = Router();

materialesRouter.use(requireAuth);

// Cualquier usuario autenticado: búsqueda liviana en el Maestro de
// Materiales de SAP para autocompletar Código/Producto al crear o editar
// un requerimiento.
materialesRouter.get("/buscar", asyncHandler(buscarMateriales));
