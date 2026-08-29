import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireCronSecret } from "../middleware/cronAuth";
import { procesarCorreosPendientes } from "../controllers/cron.controller";

export const cronRouter = Router();

cronRouter.get("/process-emails", requireCronSecret, asyncHandler(procesarCorreosPendientes));
