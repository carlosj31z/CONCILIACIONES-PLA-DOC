import type { Request, Response } from "express";
import { config } from "../config";
import { HttpError } from "../middleware/errorHandler";

interface MaestroMaterialRow {
  material: string;
  texto_material: string;
  data: Record<string, unknown> | null;
}

const CANTIDAD_CANDIDATOS = 60;
const CANTIDAD_RESULTADOS = 20;

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
 * Búsqueda en el Maestro de Materiales de SAP (herramienta "SAP MM & LM"),
 * para que al crear/editar un requerimiento se puedan tomar el Código de
 * Producto y el nombre del Producto directamente de SAP en vez de
 * escribirlos a mano. Es solo lectura (select) contra un proyecto de
 * Supabase distinto al de esta app — nunca modifica esos datos.
 */
export async function buscarMateriales(req: Request, res: Response) {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) {
    return res.json([]);
  }

  // ',' y '(' / ')' delimitan cláusulas en la sintaxis de filtros "or=(...)"
  // de PostgREST: se quitan del término de búsqueda para que no puedan
  // romper el agrupado del filtro (un término con esos caracteres es un
  // caso raro para un código/nombre de material, así que perderlos no
  // afecta la búsqueda en la práctica).
  const termino = q.replace(/[(),]/g, " ").trim();
  if (termino.length < 2) {
    return res.json([]);
  }

  const filtro = `material.ilike.*${termino}*,texto_material.ilike.*${termino}*`;
  const url =
    `${config.sapMaestro.url}/rest/v1/mm_materiales` +
    `?select=material,texto_material,data&or=(${encodeURIComponent(filtro)})&order=material.asc&limit=${CANTIDAD_CANDIDATOS}`;

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

  const filas = (await resp.json()) as MaestroMaterialRow[];

  // Deduplica por código de material (el Maestro puede tener alguna fila
  // repetida) y descarta filas sin código.
  const vistos = new Set<string>();
  const unicas = filas.filter((f) => f.material && !vistos.has(f.material) && vistos.add(f.material));

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
