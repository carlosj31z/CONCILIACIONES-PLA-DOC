-- CreateEnum
CREATE TYPE "VisibilidadNota" AS ENUM ('PRIVADA', 'COMPARTIDA');

-- CreateTable
CREATE TABLE "RecordNota" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "visibilidad" "VisibilidadNota" NOT NULL DEFAULT 'COMPARTIDA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecordNota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaAdjunto" (
    "id" TEXT NOT NULL,
    "notaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "ruta" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotaAdjunto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecordNota_recordId_idx" ON "RecordNota"("recordId");

-- CreateIndex
CREATE INDEX "RecordNota_autorId_idx" ON "RecordNota"("autorId");

-- CreateIndex
CREATE INDEX "NotaAdjunto_notaId_idx" ON "NotaAdjunto"("notaId");

-- AddForeignKey
ALTER TABLE "RecordNota" ADD CONSTRAINT "RecordNota_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "ConciliationRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordNota" ADD CONSTRAINT "RecordNota_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaAdjunto" ADD CONSTRAINT "NotaAdjunto_notaId_fkey" FOREIGN KEY ("notaId") REFERENCES "RecordNota"("id") ON DELETE CASCADE ON UPDATE CASCADE;
