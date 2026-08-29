-- AlterTable
ALTER TABLE "ConciliationRecord" ADD COLUMN "asuntosRegulatorios" TEXT,
ADD COLUMN "materialesAConciliar" TEXT NOT NULL DEFAULT '';

ALTER TABLE "ConciliationRecord" ALTER COLUMN "materialesAConciliar" DROP DEFAULT;
