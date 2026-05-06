// Parsing das planilhas + cruzamento com fator-caixa
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
export type WmgRaw = { 
  sku: string | null; 
  fator: number; 
  nome: string | null;
  sep: string | null;
  cko: string | null;
  cv: string | null;
};
export type WxdRaw = {
  cliente: string | null;
  pedido: string | null;
  sit_fase: string | null;
  dt_embarque: string | null;
};

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
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return new Date(Date.UTC(d.y, d.m - 1, d.d, d.H, d.M, Math.floor(d.S))).toISOString();
  }
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
};

function readSheetRaw(buf: ArrayBuffer): unknown[][] {
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sh = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sh, { header: 1, defval: null }) as unknown[][];
}

function toObjects(rows: unknown[][], headerRowIdx = 0): Record<string, unknown>[] {
  if (!rows.length) return [];
  const headers = rows[headerRowIdx].map((h) => String(h ?? "").trim());
  return rows.slice(headerRowIdx + 1).map((row) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

const pick = (row: Record<string, unknown>, keys: string[]): unknown => {
  for (const k of keys) if (k in row && row[k] !== null && row[k] !== undefined) return row[k];
  const lower = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k.toLowerCase().trim(), v]),
  );
  for (const k of keys) {
    const v = lower[k.toLowerCase().trim()];
    if (v !== undefined && v !== null) return v;
  }
  return null;
};

export function parseWku(buf: ArrayBuffer): WkuRaw[] {
  const rows = toObjects(readSheetRaw(buf), 0);
  return rows
    .map((r) => ({
      cliente: norm(pick(r, ["Cliente"])),
      pedido: norm(pick(r, ["No. Ped. Cli.", "No Ped Cli", "Pedido"])),
      dt_conf_sep: dateIso(pick(r, ["Dt. Conf. Sep.", "Dt Conf Sep"])),
      sku: norm(pick(r, ["Cód. Merc.", "Cod. Merc.", "SKU"])),
      nome: norm(pick(r, ["Nome Mercadoria", "Mercadoria"])),
      qt_item: num(pick(r, ["Qt. Ítem", "Qt. Item", "Qt Item"])),
      pct_sep: num(pick(r, ["% Sep.", "% Sep"])),
      pct_cko: num(pick(r, ["% Cko.", "% Cko"])),
    }))
    .filter((r) => r.pedido || r.sku);
}

/**
 * WMG dos clientes APICE/BEAUTY. O cabeçalho real está na linha 1 (linha 0 = título "CADASTRO X").
 * Detectamos automaticamente onde está "Cód. Merc." para suportar qualquer layout.
 */
export function parseWmg(buf: ArrayBuffer): WmgRaw[] {
  const raw = readSheetRaw(buf);
  let headerIdx = 0;
  for (let i = 0; i < Math.min(5, raw.length); i++) {
    const joined = raw[i].map((c) => String(c ?? "").toLowerCase()).join("|");
    if (joined.includes("cód. merc") || joined.includes("cod. merc") || joined.includes("fator")) {
      headerIdx = i;
      break;
    }
  }
  const headerRow = raw[headerIdx] || [];
  const hasCvColumn = headerRow.some(c => {
    const s = String(c ?? "").toLowerCase().trim();
    return s === "cv" || s === "cv.";
  });

  const rows = toObjects(raw, headerIdx);
  return rows
    .map((r) => ({
      sku: norm(pick(r, ["Cód. Merc.", "Cod. Merc.", "SKU"])),
      fator: num(pick(r, ["Fator"])),
      nome: norm(pick(r, ["Nome Mercadoria", "Mercadoria"])),
      sep: norm(pick(r, ["Sep.", "Sep", "SEP"])),
      cko: norm(pick(r, ["Cko.", "Cko", "CKO"])),
      cv: hasCvColumn ? norm(pick(r, ["Cv.", "Cv", "CV"])) : "x",
    }))
    .filter((r) => r.sku);
}

export function parseWxd(buf: ArrayBuffer): WxdRaw[] {
  const rows = toObjects(readSheetRaw(buf), 0);
  return rows
    .map((r) => ({
      cliente: norm(pick(r, ["Cliente"])),
      pedido: norm(pick(r, ["No. Ped. Cli.", "No Ped Cli", "Pedido"])),
      sit_fase: norm(pick(r, ["Sit. Fase", "Situação Fase", "Situacao Fase"])),
      dt_embarque: dateIso(pick(r, ["Dt. Embarque", "Dt Embarque"])),
    }))
    .filter((r) => r.pedido);
}

/**
 * Une múltiplas WMG (APICE + BEAUTY). Para cada SKU pega o MAIOR Fator (>1 = caixa).
 */
export function buildFatorMap(wmgs: WmgRaw[][]): Map<string, number> {
  const m = new Map<string, number>();
  for (const wmg of wmgs) {
    for (const r of wmg) {
      if (!r.sku) continue;
      
      const f = Math.floor(r.fator || 1);
      
      // Só consideramos esse fator como "caixa fechada" (>1)
      // se a embalagem estiver validada nas colunas SEP, CKO e CV com "X"
      const hasSep = r.sep?.trim().toLowerCase() === "x";
      const hasCko = r.cko?.trim().toLowerCase() === "x";
      const hasCv = r.cv?.trim().toLowerCase() === "x";
      
      let validFator = 1;
      if (f > 1 && hasSep && hasCko && hasCv) {
        validFator = f;
      }

      if (validFator > 1) {
        const cur = m.get(r.sku);
        if (!cur || cur === 1) {
          m.set(r.sku, validFator);
        } else {
          m.set(r.sku, Math.min(cur, validFator));
        }
      }
    }
  }
  return m;
}

export type WkuComputed = WkuRaw & {
  fator_caixa: number;
  caixas: number;
  fracionado: number;
  is_apice_beauty: boolean;
};

const APICE_BEAUTY = /apice|ápice|beauty/i;

/**
 * Calcula caixas/fracionado APENAS para clientes APICE e BEAUTY.
 * - Se Qt.Item / fator dá número inteiro → tudo é caixa fechada
 * - Se dá quebrado → caixas (parte inteira) + fração (resto)
 */
export function computeWku(wku: WkuRaw[], fatorMap: Map<string, number>): WkuComputed[] {
  return wku.map((r) => {
    const isAB = !!r.cliente && APICE_BEAUTY.test(r.cliente);
    if (!isAB) {
      return { ...r, fator_caixa: 1, caixas: 0, fracionado: 0, is_apice_beauty: false };
    }
    const fator = r.sku ? fatorMap.get(r.sku) ?? 1 : 1;
    const qt = r.qt_item || 0;
    const caixas = fator > 1 ? Math.floor(qt / fator) : 0;
    const fracionado = fator > 1 ? qt - caixas * fator : qt;
    return { ...r, fator_caixa: fator, caixas, fracionado, is_apice_beauty: true };
  });
}
