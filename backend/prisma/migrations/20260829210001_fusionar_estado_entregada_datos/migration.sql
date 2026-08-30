-- Migra los registros existentes al estado fusionado ENTREGADA. Va en una
-- migración separada del ALTER TYPE que lo creó porque Postgres exige que
-- el nuevo valor del enum esté confirmado (committed) antes de poder
-- usarlo; ver el comentario en …_fusionar_estado_entregada.
--
-- Los valores viejos quedan declarados en el enum (Postgres no permite
-- borrarlos sin recrear el tipo) pero la app deja de producirlos.
UPDATE "ConciliationRecord"
SET estado = 'ENTREGADA'
WHERE estado IN ('RECETA_GENERADA', 'ACTUALIZACION_COMPLETADA');
