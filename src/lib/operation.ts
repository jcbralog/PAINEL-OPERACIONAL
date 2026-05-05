// Lógica de cálculo cliente-side: parsing das planilhas + cruzamento WMG.
import * as XLSX from "xlsx";

export type WkuRaw = {
  cliente: string | null;
  pedido: string | null;
  dt_conf_sep: string | null;
  sku: string | null;
  nome: string | null;
  qt_item: number;
  pct_sep: number;
  pct_cko: number;
};
export type WmgRaw = { sku: string | null; fator: number; nome: string | null };
export type WduRaw = { cliente: string | null; pedido: string | null; sit_fase: string | null };

const norm = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
};
const num = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const dateIso = (v: unknown): string | null => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return new Date(Date.UTC(d.y, d.m - 1, d.d, d.H, d.M, Math.floor(d.S))).toISOString();
  }
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
};

function readSheet(file: ArrayBuffer): Record<string, unknown>[] {
  const wb = XLSX.read(file, { type: "array", cellDates: true });
  const sh = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sh, { defval: null });
}

const pick = (row: Record<string, unknown>, keys: string[]): unknown => {
  for (const k of keys) if (k in row) return row[k];
  // tentar match case-insensitive / espaços
  const lower = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase().trim(), v]));
  for (const k of keys) {
    const v = lower[k.toLowerCase().trim()];
    if (v !== undefined) return v;
  }
  return null;
};

export function parseWku(buf: ArrayBuffer): WkuRaw[] {
  return readSheet(buf).map((r) => ({
    cliente: norm(pick(r, ["Cliente"])),
    pedido: norm(pick(r, ["No. Ped. Cli.", "No Ped Cli", "Pedido"])),
    dt_conf_sep: dateIso(pick(r, ["Dt. Conf. Sep.", "Dt Conf Sep"])),
    sku: norm(pick(r, ["Cód. Merc.", "Cod. Merc.", "SKU"])),
    nome: norm(pick(r, ["Nome Mercadoria", "Mercadoria"])),
    qt_item: num(pick(r, ["Qt. Ítem", "Qt. Item", "Qt Item"])),
    pct_sep: num(pick(r, ["% Sep.", "% Sep"])),
    pct_cko: num(pick(r, ["% Cko.", "% Cko"])),
  }));
}
export function parseWmg(buf: ArrayBuffer): WmgRaw[] {
  return readSheet(buf).map((r) => ({
    sku: norm(pick(r, ["Cód. Merc.", "Cod. Merc.", "SKU"])),
    fator: num(pick(r, ["Fator"])),
    nome: norm(pick(r, ["Nome Mercadoria", "Mercadoria"])),
  }));
}
export function parseWdu(buf: ArrayBuffer): WduRaw[] {
  return readSheet(buf).map((r) => ({
    cliente: norm(pick(r, ["Cliente"])),
    pedido: norm(pick(r, ["No. Ped. Cli.", "No Ped Cli", "Pedido"])),
    sit_fase: norm(pick(r, ["Sit. Fase", "Situação Fase", "Situacao Fase"])),
  }));
}

/**
 * Para cada SKU da WMG, escolhe o MAIOR Fator > 1 como fator-caixa.
 * Se só houver Fator=1, fator-caixa = 1 (produto solto).
 */
export function buildFatorMap(wmg: WmgRaw[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of wmg) {
    if (!r.sku) continue;
    const cur = m.get(r.sku) ?? 1;
    if (r.fator > cur) m.set(r.sku, Math.floor(r.fator));
  }
  return m;
}

export type WkuComputed = WkuRaw & { fator_caixa: number; caixas: number; fracionado: number };

export function computeWku(wku: WkuRaw[], fatorMap: Map<string, number>): WkuComputed[] {
  return wku.map((r) => {
    const fator = r.sku ? fatorMap.get(r.sku) ?? 1 : 1;
    const qt = r.qt_item || 0;
    const caixas = fator > 1 ? Math.floor(qt / fator) : 0;
    const fracionado = fator > 1 ? qt - caixas * fator : qt;
    return { ...r, fator_caixa: fator, caixas, fracionado };
  });
}
