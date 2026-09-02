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
  /*
    Recorre también lo que haya adentro de columnas JSON. La tabla hermana
    (mm_materiales) guarda los atributos de SAP dentro de una columna `data`
    en vez de en columnas sueltas —"Denominación tipo material" vive ahí—, y
    es de esperar que mm_bom haga lo mismo. Mirando solo valores de texto de
    primer nivel, una etapa guardada dentro de ese JSON se salta entera: la
    etapa queda vacía, el filtro de abajo descarta TODAS las filas y la
    búsqueda devuelve cero resultados aunque SAP haya respondido bien.
  */
  const etapaDe = (valor: unknown, columna: string): string => {
    if (typeof valor === "string") {
      if (/acondicionad/i.test(valor)) return ETAPA_ACONDICIONADO;
      if (/envas/i.test(valor)) return ETAPA_ENVASE;
      return "";
    }
    if (valor && typeof valor === "object") {
      for (const [clave, anidado] of Object.entries(valor as Record<string, unknown>)) {
        // Dentro del JSON la clave puede ser la que nombra la etapa
        // ("Etapa": "Envase"), así que no se filtra por nombre de columna.
        const encontrada = etapaDe(anidado, clave);
        if (encontrada) return encontrada;
      }
    }
    return "";
  };

  for (const [columna, valor] of Object.entries(fila)) {
    // El nombre del producto puede contener "ENVASE" sin ser la etapa; esas
    // columnas se saltan solo en el primer nivel, que es donde viven.
    if (COLUMNAS_NO_ETAPA.has(columna)) continue;
    const etapa = etapaDe(valor, columna);
    if (etapa) return etapa;
  }
  return "";
}

/**
 * La alternativa puede venir como columna suelta (`lista_alt`) o dentro de
 * la columna JSON de atributos, igual que la etapa. Se busca en los dos
 * lados para no depender de cómo esté armada la tabla.
 */
export function alternativaDeLaLista(fila: MaestroBomRow): string | null {
  if (fila.lista_alt != null && String(fila.lista_alt).trim() !== "") {
    return String(fila.lista_alt);
  }
  for (const valor of Object.values(fila)) {
    if (!valor || typeof valor !== "object") continue;
    for (const [clave, anidado] of Object.entries(valor as Record<string, unknown>)) {
      if (!/alt/i.test(clave)) continue;
      if (anidado == null || String(anidado).trim() === "") continue;
      return String(anidado);
    }
  }
  return null;
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
 * El campo "Producto" del requerimiento siempre es un producto terminado
 * (ZTER), o sea el acondicionado: el producto ya empacado en su
 * presentación final.
 *
 * Antes se deducía por el prefijo del código ("6"). Se cambió al tipo de
 * material real ("Denominación tipo material", que vive dentro de la
 * columna JSON `data` — ver `tipoMaterialLabel`) porque el prefijo es una
 * convención del código, no el dato que efectivamente clasifica el
 * material en SAP.
 */
const CONDICION_PRODUCTO_TERMINADO = `data->>${encodeURIComponent("Denominación tipo material")}.ilike.*${encodeURIComponent("producto terminado")}*`;

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

/** "Texto de inspección": el único campo por el que se busca en "Buscar en el Maestro de Materiales (SAP)". */
function textoInspeccionLabel(data: Record<string, unknown> | null): string {
  const texto = data?.["Texto de inspección"];
  return typeof texto === "string" ? texto : "";
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
 * Igual que `condicionesPorPalabra`, pero para "Buscar en el Maestro de
 * Materiales (SAP)": ahí se busca ÚNICAMENTE en "Texto de inspección" (una
 * clave dentro de la columna JSON `data`), ni por código ni por la
 * descripción general — a diferencia de "Recetas a conciliar", que sigue
 * usando `condicionesPorPalabra` sin tocar.
 */
function condicionesPorPalabraTextoInspeccion(termino: string): string[] {
  const columna = `data->>${encodeURIComponent("Texto de inspección")}`;
  return termino
    .split(/\s+/)
    .filter(Boolean)
    .map((palabra) => `${columna}.ilike.*${encodeURIComponent(palabra)}*`);
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
async function buscarCandidatosMaterial(
  termino: string,
  condicionCodigo: string,
  condicionesTexto: string[] = condicionesPorPalabra(termino)
): Promise<MaestroMaterialRow[]> {
  const condiciones = [...condicionesTexto, condicionCodigo];
  const filas = await sapFetch<MaestroMaterialRow[]>(
    `mm_materiales?select=material,texto_material,data` +
      `&and=(${condiciones.join(",")})` +
      `&order=material.asc&limit=${TOPE_MATERIALES}`
  );
  const vistos = new Set<string>();
  return filas.filter((f) => f.material && !vistos.has(f.material) && vistos.add(f.material));
}

/**
 * Búsqueda en el Maestro de Materiales de SAP (herramienta "SAP MM & LM")
 * para el campo "Producto" del requerimiento — es la única forma de
 * fijarlo, ya no hay una casilla de texto aparte. Busca únicamente en
 * "Texto de inspección" (no por código) y solo entre materiales tipo
 * Producto Terminado (ZTER). El "Cód. Producto" no sale de acá: se escribe
 * a mano por separado. Es solo lectura contra un proyecto de Supabase
 * distinto al de esta app — nunca modifica esos datos.
 */
export async function buscarMateriales(req: Request, res: Response) {
  const termino = limpiarTermino(String(req.query.q ?? "").trim());
  if (termino.length < 2) {
    return res.json({ resultados: [], truncado: false });
  }

  const filas = await buscarCandidatosMaterial(
    termino,
    CONDICION_PRODUCTO_TERMINADO,
    condicionesPorPalabraTextoInspeccion(termino)
  );

  res.json({
    resultados: filas.map((f) => ({
      codigo: f.material,
      producto: textoInspeccionLabel(f.data),
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

  /*
    "Que no empiece con 1" se expresa como "que empiece con cualquier otro
    dígito", en vez de con una negación.

    Es a propósito: la sintaxis de negación de PostgREST dentro de una
    agrupación and()/or() se escribe distinto que suelta, no se pudo
    verificar contra el SAP real desde el entorno de desarrollo, y dos
    intentos de adivinarla dejaron la búsqueda devolviendo cero resultados.
    Esta forma —un or() de `like` por prefijo— es exactamente la misma que
    usa `buscarMateriales`, que sí funciona en producción, así que no
    depende de ninguna suposición.
  */
  const otrosPrefijos = ["0", "2", "3", "4", "5", "6", "7", "8", "9"];
  const productos = await buscarCandidatosMaterial(
    termino,
    `or(${otrosPrefijos.map((p) => `material.like.${p}*`).join(",")})`
  );
  if (productos.length === 0) {
    return res.json({ resultados: [], truncado: false });
  }

  const usados = productos.slice(0, TOPE_PRODUCTOS_PARA_BOM);
  const nombrePorCodigo = new Map(usados.map((p) => [p.material, p.texto_material || ""]));

  const inLista = usados.map((p) => encodeURIComponent(p.material)).join(",");
  // select=* porque la etapa está en una columna de mm_bom cuyo nombre no
  // conocemos; `etapaDeLaLista` la ubica por su valor.
  // Se ordena solo por `material`: ordenar además por `lista_alt` obligaría a
  // que esa columna exista con ese nombre exacto, y el orden final por
  // alternativa se hace igual acá abajo con el valor ya normalizado.
  const filas = await sapFetch<MaestroBomRow[]>(
    `mm_bom?select=*&material=in.(${inLista})&order=material.asc&limit=${TOPE_LISTAS}`
  );

  const resultados = filas
    .map((f) => {
      const alt = alternativaDeLaLista(f);
      return {
        material: f.material,
        // Normalizada: SAP devuelve "1" y "05" indistintamente, y verlas
        // mezcladas en la misma lista ("Alt. 1" junto a "Alt. 05") parece un
        // error. El cero a la izquierda no distingue nada.
        listaAlt: String(Number.parseInt(String(alt ?? "1").trim(), 10) || 1),
        producto: nombrePorCodigo.get(f.material) || "",
        centro: f.centro || "",
        estado: f.estado || "",
        etapa: etapaDeLaLista(f),
        _alt: alt,
      };
    })
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

/**
 * Diagnóstico (solo ADMIN): devuelve cómo se ven de verdad las filas de
 * mm_bom para un producto, y qué etapa/alternativa deduce de cada una.
 *
 * Existe porque el SAP real no es alcanzable desde el entorno de
 * desarrollo: la forma exacta de esa tabla (nombres de columnas, si los
 * atributos van sueltos o dentro de un JSON, cómo se escribe la etapa) solo
 * se puede confirmar consultándola desde producción. Sin esto, cualquier
 * corrección sobre el filtrado de recetas es una suposición.
 *
 * No expone nada que el usuario no pueda ver ya por la búsqueda normal —
 * son los mismos datos de solo lectura del maestro—, pero se limita a ADMIN
 * porque su salida es ruido técnico, no información de trabajo.
 */
export async function diagnosticarListas(req: Request, res: Response) {
  const termino = limpiarTermino(String(req.query.q ?? "").trim());
  if (termino.length < 2) {
    throw new HttpError(400, "Indica un texto de al menos 2 caracteres en ?q=");
  }

  const otrosPrefijos = ["0", "2", "3", "4", "5", "6", "7", "8", "9"];
  const productos = await buscarCandidatosMaterial(
    termino,
    `or(${otrosPrefijos.map((p) => `material.like.${p}*`).join(",")})`
  );

  if (productos.length === 0) {
    return res.json({
      termino,
      productosEncontrados: 0,
      diagnostico: "La búsqueda de materiales no devolvió ningún producto: el problema está antes de consultar mm_bom.",
      filas: [],
    });
  }

  const usados = productos.slice(0, 5);
  const inLista = usados.map((p) => encodeURIComponent(p.material)).join(",");
  const filas = await sapFetch<MaestroBomRow[]>(
    `mm_bom?select=*&material=in.(${inLista})&order=material.asc&limit=20`
  );

  res.json({
    termino,
    productosEncontrados: productos.length,
    materialesConsultados: usados.map((p) => p.material),
    filasRecibidas: filas.length,
    // La fila cruda, tal cual la manda SAP: es lo que hace falta ver para
    // saber dónde vive la etapa y cómo está escrita.
    ejemploFilaCruda: filas[0] ?? null,
    columnasDetectadas: filas[0] ? Object.keys(filas[0]) : [],
    interpretacion: filas.map((f) => ({
      material: f.material,
      etapaDetectada: etapaDeLaLista(f) || "(vacía — por esto se descarta)",
      alternativaDetectada: alternativaDeLaLista(f) ?? "(no encontrada)",
      pasaElFiltro: ORDEN_ETAPAS.includes(etapaDeLaLista(f)) && alternativaPermitida(alternativaDeLaLista(f)),
    })),
  });
}
