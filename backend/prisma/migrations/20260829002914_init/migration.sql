-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PLANEAMIENTO', 'DOC_TECNICA', 'ADMIN');

-- CreateEnum
CREATE TYPE "TipoFlujo" AS ENUM ('GENERAR_RECETA', 'ACTUALIZAR_SIN_CONCILIACION');

-- CreateEnum
CREATE TYPE "EstadoRegistro" AS ENUM ('PENDIENTE_PLANEAMIENTO', 'EN_REVISION_TECNICA', 'RECETA_GENERADA', 'ACTUALIZACION_COMPLETADA');

-- CreateEnum
CREATE TYPE "TriggerCorreo" AS ENUM ('NUEVO_REQUERIMIENTO', 'RECETA_LISTA');

-- CreateEnum
CREATE TYPE "EstadoEnvioCorreo" AS ENUM ('PENDIENTE', 'ENVIADO', 'FALLIDO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConciliationRecord" (
    "id" TEXT NOT NULL,
    "codigoProducto" TEXT,
    "producto" TEXT NOT NULL,
    "planta" TEXT NOT NULL,
    "fechaConciliacion" TIMESTAMP(3) NOT NULL,
    "motivoConciliacion" TEXT NOT NULL,
    "tipoFlujo" "TipoFlujo",
    "estado" "EstadoRegistro" NOT NULL DEFAULT 'PENDIENTE_PLANEAMIENTO',
    "creadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConciliationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordLote" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "numeroLote" TEXT NOT NULL,
    "detalle" TEXT,

    CONSTRAINT "RecordLote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicalResponse" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "variantes" TEXT,
    "ejecucion" TEXT,
    "observaciones" TEXT,
    "completadoPorId" TEXT,
    "completadoAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnicalResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailRecipient" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "trigger" "TriggerCorreo" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "trigger" "TriggerCorreo" NOT NULL,
    "destinatarios" TEXT NOT NULL,
    "asunto" TEXT NOT NULL,
    "cuerpoHtml" TEXT NOT NULL,
    "estado" "EstadoEnvioCorreo" NOT NULL DEFAULT 'PENDIENTE',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "ultimoError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadoAt" TIMESTAMP(3),

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusHistory" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "estadoDesde" "EstadoRegistro",
    "estadoHasta" "EstadoRegistro" NOT NULL,
    "comentario" TEXT,
    "cambiadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "ConciliationRecord_estado_idx" ON "ConciliationRecord"("estado");

-- CreateIndex
CREATE INDEX "ConciliationRecord_planta_idx" ON "ConciliationRecord"("planta");

-- CreateIndex
CREATE INDEX "ConciliationRecord_codigoProducto_idx" ON "ConciliationRecord"("codigoProducto");

-- CreateIndex
CREATE INDEX "RecordLote_recordId_idx" ON "RecordLote"("recordId");

-- CreateIndex
CREATE UNIQUE INDEX "TechnicalResponse_recordId_key" ON "TechnicalResponse"("recordId");

-- CreateIndex
CREATE INDEX "EmailRecipient_recordId_trigger_idx" ON "EmailRecipient"("recordId", "trigger");

-- CreateIndex
CREATE INDEX "EmailLog_estado_idx" ON "EmailLog"("estado");

-- CreateIndex
CREATE INDEX "StatusHistory_recordId_idx" ON "StatusHistory"("recordId");

-- AddForeignKey
ALTER TABLE "ConciliationRecord" ADD CONSTRAINT "ConciliationRecord_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordLote" ADD CONSTRAINT "RecordLote_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "ConciliationRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicalResponse" ADD CONSTRAINT "TechnicalResponse_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "ConciliationRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicalResponse" ADD CONSTRAINT "TechnicalResponse_completadoPorId_fkey" FOREIGN KEY ("completadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailRecipient" ADD CONSTRAINT "EmailRecipient_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "ConciliationRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "ConciliationRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusHistory" ADD CONSTRAINT "StatusHistory_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "ConciliationRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusHistory" ADD CONSTRAINT "StatusHistory_cambiadoPorId_fkey" FOREIGN KEY ("cambiadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

