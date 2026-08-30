import { config } from "../config";
import { HttpError } from "../middleware/errorHandler";

/**
 * Archivos adjuntos de las notas, guardados en Supabase Storage.
 *
 * No se guardan en la base de datos a propósito: los binarios consumirían la
 * misma cuota que los requerimientos, y si esa cuota se llena deja de
 * funcionar la aplicación entera, no solo los adjuntos.
 *
 * La subida pasa por el backend (y no directo del navegador a Supabase) para
 * que el permiso se verifique en un solo lugar: la clave de servicio nunca
 * sale del servidor. El costo es que el archivo viaja dentro de la petición,
 * y las funciones de Vercel aceptan como mucho 4,5 MB de cuerpo — de ahí el
 * tope de TAMANO_MAXIMO_BYTES.
 */

export const TAMANO_MAXIMO_BYTES = 4 * 1024 * 1024;

/** Lo que se puede adjuntar: imágenes para evidencia y documentos de oficina. */
export const TIPOS_PERMITIDOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
];

/** Minutos que vive el enlace temporal con el que el navegador baja un adjunto. */
const VIGENCIA_ENLACE_SEGUNDOS = 60 * 60;

function configurado(): boolean {
  return Boolean(config.storage.url && config.storage.serviceKey);
}

function exigirConfiguracion() {
  if (!configurado()) {
    throw new HttpError(
      503,
      "Los adjuntos no están configurados. Falta definir SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY."
    );
  }
}

function cabeceras(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: config.storage.serviceKey,
    Authorization: `Bearer ${config.storage.serviceKey}`,
    ...extra,
  };
}

const base = () => `${config.storage.url.replace(/\/$/, "")}/storage/v1`;

/**
 * Nombre seguro dentro del bucket. El nombre que eligió el usuario se guarda
 * aparte en la base: acá solo interesa que la ruta sea única y que no pueda
 * escaparse de su carpeta con "../" ni traer caracteres raros.
 */
export function rutaDeAdjunto(notaId: string, nombreOriginal: string): string {
  const limpio = nombreOriginal
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-80);
  return `notas/${notaId}/${Date.now()}-${limpio || "archivo"}`;
}

export async function subirAdjunto(ruta: string, contenido: Buffer, tipo: string): Promise<void> {
  exigirConfiguracion();
  let resp: Response;
  try {
    resp = await fetch(`${base()}/object/${config.storage.bucket}/${encodeURI(ruta)}`, {
      method: "POST",
      headers: cabeceras({ "content-type": tipo, "cache-control": "3600" }),
      body: new Uint8Array(contenido),
    });
  } catch {
    throw new HttpError(502, "No se pudo conectar con el almacenamiento de archivos");
  }
  if (!resp.ok) {
    const detalle = await resp.text().catch(() => "");
    // 404 del bucket es el error de configuración más probable, y el mensaje
    // crudo de Supabase no lo explica.
    if (resp.status === 404) {
      throw new HttpError(503, `No existe el bucket "${config.storage.bucket}" en Supabase Storage.`);
    }
    throw new HttpError(502, `El almacenamiento rechazó el archivo: ${detalle.slice(0, 160)}`);
  }
}

export async function borrarAdjunto(ruta: string): Promise<void> {
  if (!configurado()) return;
  try {
    await fetch(`${base()}/object/${config.storage.bucket}/${encodeURI(ruta)}`, {
      method: "DELETE",
      headers: cabeceras(),
    });
  } catch {
    // Si el borrado del archivo falla, la fila igual se elimina: es preferible
    // dejar un archivo huérfano en el bucket a dejar en la nota un adjunto
    // que el usuario ya no puede quitar.
  }
}

/**
 * Enlace temporal para que el navegador muestre o descargue el archivo. Se
 * usa esto en vez de servir los bytes desde la API porque una etiqueta <img>
 * no puede mandar la cabecera de autenticación.
 */
export async function enlaceTemporal(ruta: string): Promise<string> {
  exigirConfiguracion();
  let resp: Response;
  try {
    resp = await fetch(`${base()}/object/sign/${config.storage.bucket}/${encodeURI(ruta)}`, {
      method: "POST",
      headers: cabeceras({ "content-type": "application/json" }),
      body: JSON.stringify({ expiresIn: VIGENCIA_ENLACE_SEGUNDOS }),
    });
  } catch {
    throw new HttpError(502, "No se pudo conectar con el almacenamiento de archivos");
  }
  if (!resp.ok) throw new HttpError(502, "No se pudo generar el enlace del archivo");

  const { signedURL, signedUrl } = (await resp.json()) as { signedURL?: string; signedUrl?: string };
  const relativa = signedURL ?? signedUrl;
  if (!relativa) throw new HttpError(502, "El almacenamiento no devolvió un enlace válido");
  return `${base()}${relativa.startsWith("/") ? "" : "/"}${relativa}`;
}
