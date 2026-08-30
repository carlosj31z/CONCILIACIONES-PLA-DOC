import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  actualizarUsuario,
  crearUsuario,
  directorioUsuarios,
  eliminarUsuario,
  listarUsuarios,
} from "../controllers/users.controller";

export const usersRouter = Router();

usersRouter.use(requireAuth);

// Cualquier usuario autenticado: directorio liviano para prellenar destinatarios.
usersRouter.get("/directorio", asyncHandler(directorioUsuarios));

// Solo ADMIN: administración completa de cuentas.
usersRouter.get("/", requireRole("ADMIN"), asyncHandler(listarUsuarios));
usersRouter.post("/", requireRole("ADMIN"), asyncHandler(crearUsuario));
usersRouter.patch("/:id", requireRole("ADMIN"), asyncHandler(actualizarUsuario));
usersRouter.delete("/:id", requireRole("ADMIN"), asyncHandler(eliminarUsuario));
