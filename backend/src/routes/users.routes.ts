import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { actualizarUsuario, crearUsuario, listarUsuarios } from "../controllers/users.controller";

export const usersRouter = Router();

usersRouter.use(requireAuth, requireRole("ADMIN"));

usersRouter.get("/", asyncHandler(listarUsuarios));
usersRouter.post("/", asyncHandler(crearUsuario));
usersRouter.patch("/:id", asyncHandler(actualizarUsuario));
