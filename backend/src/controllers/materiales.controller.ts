import type { Request, Response } from "express";
import { config } from "../config";
import { HttpError } from "../middleware/errorHandler";

interface MaestroMaterialRow {
  material: string;
  texto_material: string;
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
    `?select=material,texto_material&or=(${encodeURIComponent(filtro)})&order=material.asc&limit=20`;

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
  const resultado = filas
    .filter((f) => f.material && !vistos.has(f.material) && vistos.add(f.material))
    .map((f) => ({ codigo: f.material, producto: f.texto_material || "" }));

  res.json(resultado);
}
