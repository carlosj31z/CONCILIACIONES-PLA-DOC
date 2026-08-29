import { PrismaClient } from "@prisma/client";

// Instancia única de Prisma compartida por toda la app.
export const prisma = new PrismaClient();
