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

/**
 * El Maestro de Materiales incluye de todo (producto terminado, materia
 * prima, material de envase y empaque, etc.), pero en Conciliaciones el
 * campo "Producto" siempre se refiere a un producto terminado. Se detecta
 * por el texto de "Denominación tipo material" del export de SAP en vez de
 * por un código exacto (p.ej. "ZPT"), porque ese código puede variar entre
 * plantas/configuraciones, mientras que la palabra "Terminado" en la
 * denominación es estable.
 */
function esProductoTerminado(data: Record<string, unknown> | null): boolean {
  const tipo = data?.["Denominación tipo material"];
  return typeof tipo === "string" && /terminad/i.test(tipo);
}

function tipoMaterialLabel(data: Record<string, unknown> | null): string {
  const tipo = data?.["Denominación tipo material"];
  return typeof tipo === "string" ? tipo : "";
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

  // Productos terminados primero (lo que Planeamiento casi siempre busca en
  // Conciliaciones), y detrás el resto (materia prima, envase y empaque,
  // etc.) — no se ocultan del todo, por si alguna vez sí hace falta uno de
  // esos códigos.
  const terminados = unicas.filter((f) => esProductoTerminado(f.data));
  const otros = unicas.filter((f) => !esProductoTerminado(f.data));

  const resultado = [...terminados, ...otros].slice(0, CANTIDAD_RESULTADOS).map((f) => ({
    codigo: f.material,
    producto: f.texto_material || "",
    tipo: tipoMaterialLabel(f.data),
    terminado: esProductoTerminado(f.data),
  }));

  res.json(resultado);
}

/**
 * Búsqueda de listas de materiales (BOM) en el Maestro de Listas de
 * Materiales de SAP, para la sección "Recetas a conciliar" del
 * requerimiento. Se busca por producto (código o nombre, igual que
 * `buscarMateriales`) y luego se traen las listas de materiales de esos
 * productos — una lista de materiales siempre pertenece a un producto
 * terminado, así que primero se resuelve el producto y después sus listas.
 */
export async function buscarListasConciliar(req: Request, res: Response) {
  const termino = limpiarTermino(String(req.query.q ?? "").trim());
  if (termino.length < 2) {
    return res.json([]);
  }

  const candidatos = await buscarCandidatosMaterial(termino);
  const terminados = candidatos.filter((f) => esProductoTerminado(f.data));
  // Si nada calza como "terminado" (Maestro incompleto, denominación
  // distinta, etc.) se sigue con todos los candidatos en vez de devolver
  // una lista vacía sin explicación.
  const productos = terminados.length > 0 ? terminados : candidatos;

  const nombrePorCodigo = new Map(productos.map((p) => [p.material, p.texto_material || ""]));
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
  }));

  res.json(resultado);
}
