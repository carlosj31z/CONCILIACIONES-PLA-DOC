import { PrismaClient } from "@prisma/client";

// En funciones serverless (Vercel) cada invocación "fría" recrearía el
// cliente y agotaría las conexiones de Postgres. Cacheamos la instancia en
// `globalThis` para que invocaciones "calientes" reutilicen la misma
// conexión (patrón recomendado por Prisma para entornos serverless).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();
globalForPrisma.prisma = prisma;
