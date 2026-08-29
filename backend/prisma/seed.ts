import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function upsertUser(email: string, nombre: string, role: "PLANEAMIENTO" | "DOC_TECNICA" | "ADMIN") {
  const passwordHash = await bcrypt.hash("Cambiar123!", 10);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, nombre, role, passwordHash },
  });
}

async function main() {
  await upsertUser("planeamiento@empresa.com", "Usuario Planeamiento", "PLANEAMIENTO");
  await upsertUser("doctecnica@empresa.com", "Usuario Documentación Técnica", "DOC_TECNICA");
  await upsertUser("admin@empresa.com", "Administrador", "ADMIN");
  console.log("Usuarios de prueba creados. Contraseña para todos: Cambiar123!");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
