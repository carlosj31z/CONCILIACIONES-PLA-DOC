-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ConciliationRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigoProducto" TEXT,
    "producto" TEXT NOT NULL,
    "planta" TEXT NOT NULL,
    "fechaConciliacion" DATETIME NOT NULL,
    "motivoConciliacion" TEXT NOT NULL,
    "tipoFlujo" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE_PLANEAMIENTO',
    "creadoPorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConciliationRecord_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecordLote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordId" TEXT NOT NULL,
    "numeroLote" TEXT NOT NULL,
    "detalle" TEXT,
    CONSTRAINT "RecordLote_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "ConciliationRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TechnicalResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordId" TEXT NOT NULL,
    "variantes" TEXT,
    "ejecucion" TEXT,
    "observaciones" TEXT,
    "completadoPorId" TEXT,
    "completadoAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TechnicalResponse_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "ConciliationRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TechnicalResponse_completadoPorId_fkey" FOREIGN KEY ("completadoPorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailRecipient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailRecipient_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "ConciliationRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "destinatarios" TEXT NOT NULL,
    "asunto" TEXT NOT NULL,
    "cuerpoHtml" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "ultimoError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadoAt" DATETIME,
    CONSTRAINT "EmailLog_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "ConciliationRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StatusHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordId" TEXT NOT NULL,
    "estadoDesde" TEXT,
    "estadoHasta" TEXT NOT NULL,
    "comentario" TEXT,
    "cambiadoPorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StatusHistory_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "ConciliationRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StatusHistory_cambiadoPorId_fkey" FOREIGN KEY ("cambiadoPorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
