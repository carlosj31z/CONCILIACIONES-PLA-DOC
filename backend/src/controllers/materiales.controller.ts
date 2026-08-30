import type { Request, Response } from "express";
import { config } from "../config";
import { HttpError } from "../middleware/errorHandler";

interface MaestroMaterialRow {
  material: string;
  texto_material: string;
  data: Record<string, unknown> | null;
}

interface MaestroBomRow {
  material: string;
  lista_alt: string | null;
  centro: string | null;
  estado: string | null;
}

/**
 * Etapa de cada material según con qué dígito empieza su código en SAP.
 *
 * Antes esto se deducía del texto de "Denominación tipo material", que era
 * una suposición: dejaba pasar códigos de materia prima (los que empiezan
 * con 1) a la búsqueda de recetas. El prefijo del código es la regla real
 * del maestro y además se puede filtrar en la propia consulta, que es lo
 * que arregla el problema de fondo (ver `buscarCandidatosMaterial`).
 */
const PREFIJO_ENVASE = "5";
const PREFIJO_ACONDICIONADO = "6";

/**
 * El campo "Producto" del requerimiento siempre es un producto terminado, o
 * sea el acondicionado: el producto ya empacado en su presentación final.
 */
const PREFIJOS_PRODUCTO_TERMINADO = [PREFIJO_ACONDICIONADO];

/**
 * "Recetas a conciliar" admite además la etapa de envase, porque una
 * conciliación puede involucrar la lista de materiales del envasado y no
 * solo la del empaque final.
 */
const PREFIJOS_RECETA = [PREFIJO_ENVASE, PREFIJO_ACONDICIONADO];

/**
 * Topes altos: la idea es que el desplegable muestre todo lo que coincide,
 * no una muestra. No son "sin límite" del todo porque una búsqueda de dos
 * letras puede coincidir con miles de filas y dejar sin memoria al celular;
 * cuando se llega al tope, la respuesta lo avisa para que el usuario sepa
 * que le conviene afinar el texto.
 */
const TOPE_MATERIALES = 300;
/** Productos cuyos BOM se piden. Acota el largo de la URL del filtro `in.(...)`. */
const TOPE_PRODUCTOS_PARA_BOM = 150;
const TOPE_LISTAS = 600;

async function sapFetch<T>(path: string): Promise<T> {
  const url = `${config.sapMaestro.url}/rest/v1/${path}`;
  let resp;
  try {
    resp = await fetch(url, {
      headers: {
        apikey: config.sapMaestro.anonKey,
        Authorization: `Bearer ${config.sapMaestro.anonKey}`,
      },
    });
  } catch {
    throw new HttpError(502, "No se pudo conectar con el Maestro de Materiales de SAP");
  }
  if (!resp.ok) {
    throw new HttpError(502, "El Maestro de Materiales de SAP no respondió correctamente");
  }
  return (await resp.json()) as T;
}

function tipoMaterialLabel(data: Record<string, unknown> | null): string {
  const tipo = data?.["Denominación tipo material"];
  return typeof tipo === "string" ? tipo : "";
}

function etapaPorCodigo(material: string): string {
  if (material.startsWith(PREFIJO_ACONDICIONADO)) return "Acondicionado";
  if (material.startsWith(PREFIJO_ENVASE)) return "Envase";
  return "";
}

/**
 * ',' '(' ')' delimitan cláusulas en la sintaxis de filtros de PostgREST, y
 * '*' '%' son comodines de `ilike`: se quitan del término para que el texto
 * que escribe el usuario no pueda alterar la estructura del filtro.
 */
function limpiarTermino(q: string): string {
  return q.replace(/[(),*%]/g, " ").trim();
}

/**
 * Cada palabra por separado, y todas tienen que aparecer (en el código o en
 * la descripción). Así "tramedif x10" encuentra "TRAMEDIF COMPUESTO TAB B10
 * CJA x10", que con una sola coincidencia de subcadena no aparecía porque
 * las dos palabras no están pegadas en el texto.
 */
function condicionesPorPalabra(termino: string): string[] {
  return termino
    .split(/\s+/)
    .filter(Boolean)
    .map((palabra) => {
      const p = encodeURIComponent(palabra);
      return `or(material.ilike.*${p}*,texto_material.ilike.*${p}*)`;
    });
}

function condicionPrefijos(prefijos: string[]): string {
  return `or(${prefijos.map((p) => `material.like.${p}*`).join(",")})`;
}

/**
 * Busca en el Maestro de Materiales las filas que coinciden con el texto Y
 * pertenecen a alguna de las etapas pedidas.
 *
 * El filtro de etapa va DENTRO de la consulta, no después de traer los
 * datos. Antes se pedían las primeras 60 coincidencias ordenadas por código
 * y recién ahí se descartaba lo que no era producto terminado: como los
 * códigos de materia prima empiezan con 1, se llevaban esas 60 primeras y
 * no quedaba nada que mostrar. El efecto era que escribir MENOS texto daba
 * MENOS resultados — "TRAMEDIF" no encontraba nada y "TRAMEDIF COMPU" sí.
 */
async function buscarCandidatosMaterial(termino: string, prefijos: string[]): Promise<MaestroMaterialRow[]> {
  const condiciones = [...condicionesPorPalabra(termino), condicionPrefijos(prefijos)];
  const filas = await sapFetch<MaestroMaterialRow[]>(
    `mm_materiales?select=material,texto_material,data` +
      `&and=(${condiciones.join(",")})` +
      `&order=material.asc&limit=${TOPE_MATERIALES}`
  );
  const vistos = new Set<string>();
  return filas.filter((f) => f.material && !vistos.has(f.material) && vistos.add(f.material));
}

/**
 * Búsqueda en el Maestro de Materiales de SAP (herramienta "SAP MM & LM"),
 * para tomar el Código de Producto y el nombre del Producto directamente de
 * SAP en vez de escribirlos a mano. Es solo lectura contra un proyecto de
 * Supabase distinto al de esta app — nunca modifica esos datos.
 */
export async function buscarMateriales(req: Request, res: Response) {
  const termino = limpiarTermino(String(req.query.q ?? "").trim());
  if (termino.length < 2) {
    return res.json({ resultados: [], truncado: false });
  }

  const filas = await buscarCandidatosMaterial(termino, PREFIJOS_PRODUCTO_TERMINADO);

  res.json({
    resultados: filas.map((f) => ({
      codigo: f.material,
      producto: f.texto_material || "",
      tipo: tipoMaterialLabel(f.data),
    })),
    truncado: filas.length >= TOPE_MATERIALES,
  });
}

/**
 * Búsqueda de listas de materiales (BOM) para la sección "Recetas a
 * conciliar". Se resuelve en dos pasos porque el nombre del producto vive en
 * el maestro de materiales y las listas en otra tabla: primero los productos
 * que coinciden con el texto (limitados a las etapas de envase y
 * acondicionado), después las listas de esos productos.
 */
export async function buscarListasConciliar(req: Request, res: Response) {
  const termino = limpiarTermino(String(req.query.q ?? "").trim());
  if (termino.length < 2) {
    return res.json({ resultados: [], truncado: false });
  }

  const productos = await buscarCandidatosMaterial(termino, PREFIJOS_RECETA);
  if (productos.length === 0) {
    return res.json({ resultados: [], truncado: false });
  }

  const usados = productos.slice(0, TOPE_PRODUCTOS_PARA_BOM);
  const nombrePorCodigo = new Map(usados.map((p) => [p.material, p.texto_material || ""]));

  const inLista = usados.map((p) => encodeURIComponent(p.material)).join(",");
  const filas = await sapFetch<MaestroBomRow[]>(
    `mm_bom?select=material,lista_alt,centro,estado&material=in.(${inLista})` +
      `&order=material.asc,lista_alt.asc&limit=${TOPE_LISTAS}`
  );

  res.json({
    resultados: filas.map((f) => ({
      material: f.material,
      listaAlt: f.lista_alt || "1",
      producto: nombrePorCodigo.get(f.material) || "",
      centro: f.centro || "",
      estado: f.estado || "",
      etapa: etapaPorCodigo(f.material),
    })),
    truncado: productos.length > usados.length || filas.length >= TOPE_LISTAS,
  });
}
