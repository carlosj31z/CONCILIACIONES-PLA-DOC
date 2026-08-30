-- CreateTable
CREATE TABLE "EliminacionForzada" (
    "id" TEXT NOT NULL,
    "registroId" TEXT NOT NULL,
    "codigoProducto" TEXT,
    "producto" TEXT NOT NULL,
    "estadoAlBorrar" TEXT NOT NULL,
    "eliminadoPorId" TEXT NOT NULL,
    "eliminadoPorNombre" TEXT NOT NULL,
    "eliminadoPorEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EliminacionForzada_pkey" PRIMARY KEY ("id")
);
