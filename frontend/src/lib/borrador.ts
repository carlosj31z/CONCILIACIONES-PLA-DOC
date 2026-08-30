import { useEffect, useRef, useState } from "react";

/**
 * Borradores locales de formularios largos.
 *
 * Lo que se escribe en "Nuevo requerimiento" vive en memoria hasta que se
 * guarda: recargar, cambiar entre modo escritorio y móvil, o que el navegador
 * descarte la pestaña por memoria, se llevaba todo el trabajo. Acá se copia a
 * localStorage mientras se escribe y se recupera al volver.
 *
 * Es solo del navegador: no viaja al servidor ni se comparte entre
 * dispositivos. Para eso haría falta guardar el requerimiento como borrador
 * en la base, que es otra decisión (implica registros a medio llenar
 * visibles para el resto del equipo).
 */

/** Pasado este tiempo un borrador se considera viejo y no se ofrece. */
const VIGENCIA_MS = 7 * 24 * 60 * 60 * 1000;

/** Espera desde la última tecla antes de escribir a disco. */
const RETARDO_GUARDADO_MS = 600;

interface BorradorGuardado<T> {
  datos: T;
  guardadoEn: number;
}

/**
 * La clave incluye el id del usuario: en una computadora compartida, el
 * borrador de una persona no debe aparecerle a la siguiente que entre.
 */
export function claveBorrador(formulario: string, usuarioId: string | undefined): string {
  return `borrador:${formulario}:${usuarioId ?? "anonimo"}`;
}

export function leerBorrador<T>(clave: string): BorradorGuardado<T> | null {
  try {
    const crudo = localStorage.getItem(clave);
    if (!crudo) return null;
    const guardado = JSON.parse(crudo) as BorradorGuardado<T>;
    if (typeof guardado?.guardadoEn !== "number" || !guardado.datos) return null;
    if (Date.now() - guardado.guardadoEn > VIGENCIA_MS) {
      localStorage.removeItem(clave);
      return null;
    }
    return guardado;
  } catch {
    // localStorage no disponible (modo privado) o JSON corrupto: se ignora.
    return null;
  }
}

export function borrarBorrador(clave: string): void {
  try {
    localStorage.removeItem(clave);
  } catch {
    // Sin localStorage no hay nada que borrar.
  }
}

/**
 * Copia `datos` al borrador cuando dejan de cambiar por un momento, y
 * devuelve el instante del último guardado (o null si todavía no guardó
 * nada). Con `activo` en false deja de guardar — se usa al enviar el
 * formulario, para que el borrador no reviva después de limpiarlo.
 *
 * `hayContenido` evita crear un borrador por el solo hecho de abrir el
 * formulario: sin eso, entrar y salir dejaba un borrador vacío que después
 * se ofrecía recuperar.
 */
export function useAutoguardado<T>(
  clave: string,
  datos: T,
  { activo = true, hayContenido = true }: { activo?: boolean; hayContenido?: boolean } = {}
): number | null {
  const [guardadoEn, setGuardadoEn] = useState<number | null>(null);
  // En una ref para no reiniciar el temporizador cuando cambia el estado local.
  const datosRef = useRef(datos);
  datosRef.current = datos;

  const serializado = JSON.stringify(datos);

  useEffect(() => {
    if (!activo || !hayContenido) return;
    const id = window.setTimeout(() => {
      try {
        const ahora = Date.now();
        localStorage.setItem(clave, JSON.stringify({ datos: datosRef.current, guardadoEn: ahora }));
        setGuardadoEn(ahora);
      } catch {
        // Cuota llena o modo privado: el formulario sigue funcionando igual,
        // solo se queda sin respaldo.
      }
    }, RETARDO_GUARDADO_MS);
    return () => window.clearTimeout(id);
  }, [clave, serializado, activo, hayContenido]);

  return guardadoEn;
}

/** "hace un momento", "hace 5 min", "hace 2 h", "el 12/3/2026". */
export function hace(instante: number): string {
  const ms = Date.now() - instante;
  const minutos = Math.floor(ms / 60000);
  if (minutos < 1) return "hace un momento";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  return `el ${new Date(instante).toLocaleDateString("es-PE")}`;
}
