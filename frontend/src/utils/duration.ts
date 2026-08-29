export function formatDuracion(ms: number): string {
  const minutos = Math.max(0, Math.round(ms / 60000));
  const horas = Math.floor(minutos / 60);
  const dias = Math.floor(horas / 24);

  if (dias > 0) {
    const horasResto = horas % 24;
    return horasResto > 0 ? `${dias} d ${horasResto} h` : `${dias} d`;
  }
  if (horas > 0) {
    const minResto = minutos % 60;
    return minResto > 0 ? `${horas} h ${minResto} min` : `${horas} h`;
  }
  return `${minutos} min`;
}

/** Tiempo transcurrido entre que Planeamiento creó la solicitud y Documentación Técnica la resolvió (null si aún no la resuelve). */
export function tiempoResolucionMs(record: {
  createdAt: string;
  respuestaTecnica?: { completadoAt?: string | null } | null;
}): number | null {
  const completadoAt = record.respuestaTecnica?.completadoAt;
  if (!completadoAt) return null;
  return new Date(completadoAt).getTime() - new Date(record.createdAt).getTime();
}
