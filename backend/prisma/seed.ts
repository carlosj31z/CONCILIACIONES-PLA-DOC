import { PrismaClient, type Role } from "@prisma/client";

const prisma = new PrismaClient();

interface SeedUser {
  email: string;
  nombre: string;
  role: Role;
  puesto?: string;
}

// Acceso solo con correo (sin contraseña): basta con que la cuenta exista
// y esté activa. El alta y edición posteriores se hacen desde /usuarios.
const usuarios: SeedUser[] = [
  { email: "admin@empresa.com", nombre: "Administrador", role: "ADMIN" },

  // Documentación Técnica
  { email: "gborjav@humanovalab.com", nombre: "Giannina Borja Vega", role: "DOC_TECNICA", puesto: "Analista de Documentación Técnica" },
  { email: "dquirozt@humanovalab.com", nombre: "Delia Quiroz Torres", role: "DOC_TECNICA", puesto: "Analista de Documentación Técnica" },
  { email: "cjesusz@humanovalab.com", nombre: "Carlos Jesús Zegarra", role: "DOC_TECNICA", puesto: "Analista de Documentación Técnica" },
  { email: "mfernandezo@humanovalab.com", nombre: "Monica Fernandez Osores", role: "DOC_TECNICA", puesto: "Jefe de Documentación Técnica" },

  // Planeamiento
  { email: "druam@humanovalab.com", nombre: "Diego Rua Muñoz", role: "PLANEAMIENTO", puesto: "Planeador de Producción" },
  { email: "jolivaresa@humanovalab.com", nombre: "Juan Olivares Ayala", role: "PLANEAMIENTO", puesto: "Planificador de Materiales" },
  { email: "macordova@humanovalab.com", nombre: "Mabel Cordova Belleza", role: "PLANEAMIENTO", puesto: "Programador de Producción" },
  { email: "hlopezt@humanovalab.com", nombre: "Hellen Lopez Tomaya", role: "PLANEAMIENTO", puesto: "Planeador de Producción" },
  { email: "lfernandez@humanovalab.com", nombre: "Luis Fernandez", role: "PLANEAMIENTO", puesto: "Planificador de Materiales" },
];

async function main() {
  for (const u of usuarios) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { nombre: u.nombre, role: u.role, puesto: u.puesto },
      create: u,
    });
  }
  console.log(`${usuarios.length} usuarios creados/actualizados. Acceso: solo correo, sin contraseña.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
