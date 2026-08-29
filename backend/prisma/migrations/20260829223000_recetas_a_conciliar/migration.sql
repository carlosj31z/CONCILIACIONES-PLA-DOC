-- Listas de materiales (BOM) elegidas para conciliar en un requerimiento,
-- ya sea buscadas en el Maestro de Listas de Materiales de SAP
-- (origen = 'SAP', con sus datos ya copiados) o escritas a mano
-- (origen = 'MANUAL').

-- CreateTable
CREATE TABLE "RecordListaConciliar" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "material" TEXT,
    "listaAlt" TEXT,
    "producto" TEXT,
    "centro" TEXT,
    "estado" TEXT,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecordListaConciliar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecordListaConciliar_recordId_idx" ON "RecordListaConciliar"("recordId");

-- AddForeignKey
ALTER TABLE "RecordListaConciliar" ADD CONSTRAINT "RecordListaConciliar_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "ConciliationRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
