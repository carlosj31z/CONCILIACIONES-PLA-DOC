import type { Request, Response } from "express";
import { config } from "../config";
import { HttpError } from "../middleware/errorHandler";

interface MaestroMaterialRow {
  material: string;
  texto_material: string;
  data: Record<string, unknown> | null;
}

/**
 * Una fila de mm_bom. Se piden todas las columnas porque la etapa vive en
 * una de ellas y no sabemos cuál: ver `etapaDeLaLista`.
 */
interface MaestroBomRow {
  material: string;
  lista_alt: string | null;
  centro: string | null;
  estado: string | null;
  [columna: string]: unknown;
}

export const ETAPA_ACONDICIONADO = "Acondicionado";
export const ETAPA_ENVASE = "Envase";

/** Primero acondicionado, después envase. */
const ORDEN_ETAPAS = [ETAPA_ACONDICIONADO, ETAPA_ENVASE];

/** Alternativas válidas para conciliar. Las 6, 9 y demás quedan fuera. */
const ALTERNATIVAS_PERMITIDAS = [1, 2, 3, 4, 5];

/**
 * Columnas de mm_bom que NO pueden contener la etapa, para no confundirla
 * con el nombre del producto (un producto puede llamarse "… ENVASE …").
 */
const COLUMNAS_NO_ETAPA = new Set(["material", "lista_alt", "centro", "texto_material", "producto"]);

/**
 * La etapa se lee de la propia lista de materiales, no del código.
 *
 * Deducirla del primer dígito estaba mal: hay códigos que empiezan con 5 que
 * son de fabricación y no de envase, y así se colaban recetas de una etapa
 * que no corresponde. Como la etapa es una columna de texto de mm_bom pero
 * no sabemos su nombre, se busca por el VALOR entre todas las columnas: es
 * indiferente a cómo se llame la columna y deja de funcionar de forma
 * evidente (etapa vacía) si algún día cambia el vocabulario, en vez de
 * clasificar mal en silencio.
 */
export function etapaDeLaLista(fila: MaestroBomRow): string {
  for (const [columna, valor] of Object.entries(fila)) {
    if (COLUMNAS_NO_ETAPA.has(columna) || typeof valor !== "string") continue;
    if (/acondicionad/i.test(valor)) return ETAPA_ACONDICIONADO;
    if (/envas/i.test(valor)) return ETAPA_ENVASE;
  }
  return "";
}

/** "3", "03" y " 3 " son la alternativa 3; "9" y "60" quedan fuera. */
export function alternativaPermitida(listaAlt: string | null): boolean {
  const n = Number.parseInt(String(listaAlt ?? "").trim(), 10);
  return Number.isFinite(n) && ALTERNATIVAS_PERMITIDAS.includes(n);
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
/**
 * El campo "Producto" del requerimiento siempre es un producto terminado, o
 * sea el acondicionado: el producto ya empacado en su presentación final.
 */
const PREFIJOS_PRODUCTO_TERMINADO = ["6"];

/**
 * Para "Recetas a conciliar" el código solo sirve para descartar la materia
 * prima (empieza con 1). Qué etapa es cada receta lo dice la propia lista de
 * materiales, no el dígito — ver `etapaDeLaLista`.
 */
const PREFIJO_MATERIA_PRIMA = "1";

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

/**
 * Busca en el Maestro de Materiales las filas que coinciden con el texto Y
 * cumplen la condición de código que se le pase.
 *
 * El filtro de código va DENTRO de la consulta, no después de traer los
 * datos. Antes se pedían las primeras 60 coincidencias ordenadas por código
 * y recién ahí se descartaba lo que no correspondía: como los códigos de
 * materia prima empiezan con 1, se llevaban esas 60 primeras y no quedaba
 * nada que mostrar. El efecto era que escribir MENOS texto daba MENOS
 * resultados — "TRAMEDIF" no encontraba nada y "TRAMEDIF COMPU" sí.
 */
async function buscarCandidatosMaterial(termino: string, condicionCodigo: string): Promise<MaestroMaterialRow[]> {
  const condiciones = [...condicionesPorPalabra(termino), condicionCodigo];
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

  const filas = await buscarCandidatosMaterial(
    termino,
    `or(${PREFIJOS_PRODUCTO_TERMINADO.map((p) => `material.like.${p}*`).join(",")})`
  );

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

  // Del código solo se usa que no sea materia prima; la etapa la decide la lista.
  // Dentro de una agrupación and()/or() de PostgREST, la negación va como
  // prefijo "not." ANTES de la columna ("not.material.like.1*") — no entre
  // la columna y el operador ("material.not.like.1*", que es la sintaxis de
  // un parámetro de nivel superior, no la de un grupo). Con la sintaxis
  // equivocada, PostgREST simplemente no matcheaba nada de esta condición y
  // la búsqueda entera volvía vacía sin importar el producto.
  const productos = await buscarCandidatosMaterial(termino, `not.material.like.${PREFIJO_MATERIA_PRIMA}*`);
  if (productos.length === 0) {
    return res.json({ resultados: [], truncado: false });
  }

  const usados = productos.slice(0, TOPE_PRODUCTOS_PARA_BOM);
  const nombrePorCodigo = new Map(usados.map((p) => [p.material, p.texto_material || ""]));

  const inLista = usados.map((p) => encodeURIComponent(p.material)).join(",");
  // select=* porque la etapa está en una columna de mm_bom cuyo nombre no
  // conocemos; `etapaDeLaLista` la ubica por su valor.
  const filas = await sapFetch<MaestroBomRow[]>(
    `mm_bom?select=*&material=in.(${inLista})` +
      `&order=material.asc,lista_alt.asc&limit=${TOPE_LISTAS}`
  );

  const resultados = filas
    .map((f) => ({
      material: f.material,
      // Normalizada: SAP devuelve "1" y "05" indistintamente, y verlas
      // mezcladas en la misma lista ("Alt. 1" junto a "Alt. 05") parece un
      // error. El cero a la izquierda no distingue nada.
      listaAlt: String(Number.parseInt(String(f.lista_alt ?? "1").trim(), 10) || 1),
      producto: nombrePorCodigo.get(f.material) || "",
      centro: f.centro || "",
      estado: f.estado || "",
      etapa: etapaDeLaLista(f),
      _alt: f.lista_alt,
    }))
    // Solo envase y acondicionado (lo que diga la lista), y solo las
    // alternativas 1 a 5.
    .filter((r) => ORDEN_ETAPAS.includes(r.etapa) && alternativaPermitida(r._alt))
    .sort(
      (a, b) =>
        ORDEN_ETAPAS.indexOf(a.etapa) - ORDEN_ETAPAS.indexOf(b.etapa) ||
        a.material.localeCompare(b.material) ||
        Number(a.listaAlt) - Number(b.listaAlt)
    )
    .map(({ _alt, ...r }) => r);

  res.json({
    resultados,
    truncado: productos.length > usados.length || filas.length >= TOPE_LISTAS,
  });
}
