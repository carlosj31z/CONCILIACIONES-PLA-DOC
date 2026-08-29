-- AlterEnum: se agrega ENTREGADA, que fusiona RECETA_GENERADA y
-- ACTUALIZACION_COMPLETADA (la ruta elegida ya vive en la columna
-- tipoFlujo, así que el estado no necesita distinguirla).
ALTER TYPE "EstadoRegistro" ADD VALUE 'ENTREGADA';

-- Migra cualquier registro existente a ENTREGADA. Los valores viejos quedan
-- declarados en el enum (Postgres no permite borrarlos sin recrear el tipo)
-- pero la app deja de producirlos desde este commit.
UPDATE "ConciliationRecord" SET estado = 'ENTREGADA' WHERE estado IN ('RECETA_GENERADA', 'ACTUALIZACION_COMPLETADA');
