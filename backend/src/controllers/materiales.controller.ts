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

const CANTIDAD_CANDIDATOS = 60;
const CANTIDAD_RESULTADOS = 20;
const CANTIDAD_LISTAS = 40;

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
 * El Maestro de Materiales incluye de todo (producto terminado, materia
 * prima, material de envase, material de acondicionado/empaque, etc.), y
 * estas tres funciones lo clasifican por el texto de "Denominación tipo
 * material" del export de SAP en vez de por un código exacto (p.ej. "ZPT"),
 * porque ese código puede variar entre plantas/configuraciones mientras que
 * la palabra en la denominación ("Terminado", "Envase", "Acondicionado") es
 * estable.
 */
function esProductoTerminado(data: Record<string, unknown> | null): boolean {
  return /terminad/i.test(tipoMaterialLabel(data));
}

function esEtapaEnvase(data: Record<string, unknown> | null): boolean {
  return /envas/i.test(tipoMaterialLabel(data));
}

function esEtapaAcondicionado(data: Record<string, unknown> | null): boolean {
  return /acondicionad|empaque/i.test(tipoMaterialLabel(data));
}

/**
 * Para "Recetas a conciliar" el universo es más amplio que solo productos
 * terminados: en un proceso de conciliación pueden entrar también listas de
 * materiales de las etapas intermedias de envase y acondicionado (una
 * receta multinivel donde el envasado o el empaque tiene su propia lista).
 * El Maestro de Materiales sigue siendo la única fuente de tipos.
 */
function calificaParaListaConciliar(data: Record<string, unknown> | null): boolean {
  return esProductoTerminado(data) || esEtapaEnvase(data) || esEtapaAcondicionado(data);
}

function etapaLabel(data: Record<string, unknown> | null): string {
  if (esProductoTerminado(data)) return "Terminado";
  if (esEtapaEnvase(data)) return "Envase";
  if (esEtapaAcondicionado(data)) return "Acondicionado";
  return tipoMaterialLabel(data);
}

/**
 * ',' y '(' / ')' delimitan cláusulas en la sintaxis de filtros "or=(...)"
 * de PostgREST: se quitan del término de búsqueda para que no puedan romper
 * el agrupado del filtro (un término con esos caracteres es un caso raro
 * para un código/nombre de material, así que perderlos no afecta la
 * búsqueda en la práctica).
 */
function limpiarTermino(q: string): string {
  return q.replace(/[(),]/g, " ").trim();
}

/** Busca candidatos en el Maestro de Materiales por código o nombre, deduplicados por código. */
async function buscarCandidatosMaterial(termino: string): Promise<MaestroMaterialRow[]> {
  const filtro = `material.ilike.*${termino}*,texto_material.ilike.*${termino}*`;
  const filas = await sapFetch<MaestroMaterialRow[]>(
    `mm_materiales?select=material,texto_material,data&or=(${encodeURIComponent(filtro)})&order=material.asc&limit=${CANTIDAD_CANDIDATOS}`
  );
  const vistos = new Set<string>();
  return filas.filter((f) => f.material && !vistos.has(f.material) && vistos.add(f.material));
}

/**
 * Búsqueda en el Maestro de Materiales de SAP (herramienta "SAP MM & LM"),
 * para que al crear/editar un requerimiento se puedan tomar el Código de
 * Producto y el nombre del Producto directamente de SAP en vez de
 * escribirlos a mano. Es solo lectura (select) contra un proyecto de
 * Supabase distinto al de esta app — nunca modifica esos datos.
 */
export async function buscarMateriales(req: Request, res: Response) {
  const termino = limpiarTermino(String(req.query.q ?? "").trim());
  if (termino.length < 2) {
    return res.json([]);
  }

  const unicas = await buscarCandidatosMaterial(termino);

  // El campo "Producto" del requerimiento siempre es un producto terminado:
  // a diferencia de "Recetas a conciliar" (que sí admite envase y
  // acondicionado), acá se filtra estricto — materia prima, envase y
  // empaque u otros códigos no deben aparecer nunca en este buscador.
  const terminados = unicas.filter((f) => esProductoTerminado(f.data));

  const resultado = terminados.slice(0, CANTIDAD_RESULTADOS).map((f) => ({
    codigo: f.material,
    producto: f.texto_material || "",
    tipo: tipoMaterialLabel(f.data),
    terminado: true,
  }));

  res.json(resultado);
}

/**
 * Búsqueda de listas de materiales (BOM) en el Maestro de Listas de
 * Materiales de SAP, para la sección "Recetas a conciliar" del
 * requerimiento. Se busca por producto (código o nombre, igual que
 * `buscarMateriales`) y luego se traen las listas de materiales de esos
 * productos. A diferencia del buscador de "Producto" del requerimiento, acá
 * el universo no se limita a productos terminados: una conciliación puede
 * involucrar también las listas de las etapas intermedias de envase y de
 * acondicionado (`calificaParaListaConciliar`).
 */
export async function buscarListasConciliar(req: Request, res: Response) {
  const termino = limpiarTermino(String(req.query.q ?? "").trim());
  if (termino.length < 2) {
    return res.json([]);
  }

  const candidatos = await buscarCandidatosMaterial(termino);
  const calificados = candidatos.filter((f) => calificaParaListaConciliar(f.data));
  // Si nada calza con ninguna de las tres etapas (Maestro incompleto,
  // denominación distinta, etc.) se sigue con todos los candidatos en vez
  // de devolver una lista vacía sin explicación.
  const productos = calificados.length > 0 ? calificados : candidatos;

  const nombrePorCodigo = new Map(productos.map((p) => [p.material, p.texto_material || ""]));
  const etapaPorCodigo = new Map(productos.map((p) => [p.material, etapaLabel(p.data)]));
  const codigos = productos.map((p) => p.material);
  if (codigos.length === 0) {
    return res.json([]);
  }

  const inLista = codigos.map((c) => encodeURIComponent(c)).join(",");
  const filas = await sapFetch<MaestroBomRow[]>(
    `mm_bom?select=material,lista_alt,centro,estado&material=in.(${inLista})&order=material.asc,lista_alt.asc&limit=${CANTIDAD_LISTAS}`
  );

  const resultado = filas.map((f) => ({
    material: f.material,
    listaAlt: f.lista_alt || "1",
    producto: nombrePorCodigo.get(f.material) || "",
    centro: f.centro || "",
    estado: f.estado || "",
    etapa: etapaPorCodigo.get(f.material) || "",
  }));

  res.json(resultado);
}
