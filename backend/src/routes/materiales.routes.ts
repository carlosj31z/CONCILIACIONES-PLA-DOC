import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  buscarListasConciliar,
  buscarMateriales,
  diagnosticarListas,
} from "../controllers/materiales.controller";

export const materialesRouter = Router();

materialesRouter.use(requireAuth);

// Cualquier usuario autenticado: búsqueda liviana en el Maestro de
// Materiales de SAP para autocompletar Código/Producto al crear o editar
// un requerimiento.
materialesRouter.get("/buscar", asyncHandler(buscarMateriales));

// Búsqueda de listas de materiales (BOM) para la sección "Recetas a
// conciliar" del requerimiento.
materialesRouter.get("/listas", asyncHandler(buscarListasConciliar));

// Diagnóstico de por qué una búsqueda de recetas no devuelve resultados.
// Solo ADMIN: muestra la fila cruda de SAP, que es ruido técnico.
materialesRouter.get("/listas/diagnostico", requireRole("ADMIN"), asyncHandler(diagnosticarListas));
