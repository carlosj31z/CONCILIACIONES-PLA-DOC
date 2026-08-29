-- AlterEnum
ALTER TYPE "EstadoRegistro" ADD VALUE 'RECHAZADA_TECNICA';
ALTER TYPE "EstadoRegistro" ADD VALUE 'CONCLUIDA';

-- AlterEnum
ALTER TYPE "TriggerCorreo" ADD VALUE 'RECHAZO_TECNICO';
ALTER TYPE "TriggerCorreo" ADD VALUE 'DECISION_PLANEAMIENTO';

-- AlterTable
ALTER TABLE "TechnicalResponse" ADD COLUMN "motivoRechazo" TEXT;
