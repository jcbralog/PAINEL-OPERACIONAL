import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { WkuRow, WxdRow } from "./loadUpload";

// ─── Paleta executiva Bralog ───────────────────────────────────────────────────
const G = {
  // Verdes
  ink:      "071E0F",   // preto-verde para textos principais
  deep:     "0D2E18",   // verde noite (cabeçalho primário)
  forest:   "1A4D2E",   // verde floresta (cabeçalho secundário)
  pine:     "2E7D4F",   // verde pinheiro (destaques)
  sage:     "5A9E73",   // verde sálvia (subtítulos)
  mint:     "D4EDDA",   // verde menta (linhas alternadas / fundos suaves)
  white:    "FFFFFF",

  // Dourado executivo
  gold:     "8B6914",   // dourado escuro
  goldMid:  "C9A84C",   // dourado médio (bordas/acentos)
  goldPale: "FDF5DC",   // dourado pálido (fundo KPI destaque)

  // Tipo caixa / fração
  boxBg:    "E8F5E9",   // verde muito claro (caixa fechada)
  boxText:  "1A4D2E",
  fracBg:   "FFF8ED",   // âmbar muito claro (fração)
  fracText: "7B4F00",

  // Neutros
  border:   "B2CCBA",   // borda suave
  borderMd: "5A9E73",   // borda média
  rowAlt:   "F4FAF6",   // linha alternada
  muted:    "4A6B55",   // texto secundário
};

// ─── Utilitários ──────────────────────────────────────────────────────────────
function fill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb: argb } };
}
function border(argb: string, style: ExcelJS.BorderStyle = "thin"): ExcelJS.Borders {
  const b = { style, color: { argb: argb } };
  return { top: b, bottom: b, left: b, right: b };
}
function font(
  argb: string,
  size = 10,
  bold = false,
  italic = false
): Partial<ExcelJS.Font> {
  return { name: "Calibri", color: { argb: argb }, size, bold, italic };
}
function align(
  h: ExcelJS.Alignment["horizontal"] = "left",
  v: ExcelJS.Alignment["vertical"] = "middle",
  wrap = false
): Partial<ExcelJS.Alignment> {
  return { horizontal: h, vertical: v, wrapText: wrap };
}

const pct = (n: number, d: number) =>
  d > 0 ? ((n / d) * 100).toFixed(1) + "%" : "0.0%";

// ─── Cabeçalho de página com identidade Bralog ───────────────────────────────
function pageHeader(
  ws: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
  cols: number
) {
  const last = String.fromCharCode(64 + cols);

  // Faixa 1: empresa (2 linhas mescladas)
  ws.mergeCells(`A1:${last}2`);
  const c1 = ws.getCell("A1");
  c1.value = "BRALOG  LOGÍSTICA";
  c1.fill = fill(G.deep);
  c1.font = font(G.white, 22, true);
  c1.alignment = align("center", "middle");
  ws.getRow(1).height = 22;
  ws.getRow(2).height = 18;

  // Faixa 2: título do relatório
  ws.mergeCells(`A3:${last}3`);
  const c3 = ws.getCell("A3");
  c3.value = title.toUpperCase();
  c3.fill = fill(G.forest);
  c3.font = font(G.white, 13, true);
  c3.alignment = align("center", "middle");
  ws.getRow(3).height = 26;

  // Faixa 3: subtítulo + data
  ws.mergeCells(`A4:${last}4`);
  const c4 = ws.getCell("A4");
  c4.value = `${subtitle}   ·   ${new Date().toLocaleString("pt-BR")}`;
  c4.fill = fill(G.pine);
  c4.font = font(G.white, 9, false, true);
  c4.alignment = align("center", "middle");
  ws.getRow(4).height = 15;

  // Linha separadora dourada
  ws.mergeCells(`A5:${last}5`);
  const c5 = ws.getCell("A5");
  c5.fill = fill(G.goldMid);
  ws.getRow(5).height = 3;

  // Espaço
  ws.getRow(6).height = 6;
}

// ─── Linha de cabeçalho de tabela ────────────────────────────────────────────
function tableHeader(
  ws: ExcelJS.Worksheet,
  rowNum: number,
  labels: (string | null)[],
  bg = G.forest
) {
  const row = ws.getRow(rowNum);
  row.height = 22;
  labels.forEach((label, i) => {
    const c = row.getCell(i + 1);
    c.value = label;
    c.fill = fill(bg);
    c.font = font(G.white, 10, true);
    c.alignment = align("center", "middle");
    c.border = border(G.deep, "medium");
  });
}

// ─── Linha de dado ────────────────────────────────────────────────────────────
function addDataRow(
  ws: ExcelJS.Worksheet,
  values: (string | number | null)[],
  idx: number,
  cellStyles?: Record<number, { bg?: string; fg?: string; bold?: boolean; hAlign?: ExcelJS.Alignment["horizontal"] }>
) {
  const row = ws.addRow(values);
  row.height = 17;
  row.eachCell({ includeEmpty: true }, (cell, colNum) => {
    const s = cellStyles?.[colNum];
    const isNum = typeof cell.value === "number";
    cell.fill = fill(s?.bg ?? (idx % 2 === 0 ? G.white : G.rowAlt));
    cell.font = font(s?.fg ?? G.ink, 10, s?.bold ?? false);
    cell.alignment = align(s?.hAlign ?? (isNum ? "center" : "left"), "middle");
    cell.border = border(G.border);
  });
}

// ─── Título de seção interno ──────────────────────────────────────────────────
function sectionTitle(
  ws: ExcelJS.Worksheet,
  rowNum: number,
  text: string,
  cols: number,
  bg = G.deep
) {
  const last = String.fromCharCode(64 + cols);
  ws.mergeCells(`A${rowNum}:${last}${rowNum}`);
  const c = ws.getCell(`A${rowNum}`);
  c.value = `  ${text}`;
  c.fill = fill(bg);
  c.font = font(G.white, 11, true);
  c.alignment = align("left", "middle");
  c.border = border(G.goldMid, "medium");
  ws.getRow(rowNum).height = 20;
}

// ─── Mapa de KPIs disponíveis ─────────────────────────────────────────────────
type KpiId = "produzidos" | "separados" | "checkout" | "embarcados" | "itens" | "skus";

function getKpiData(id: KpiId, kpis: any, pctFn: typeof pct) {
  const total = kpis.pedidos;
  switch (id) {
    case "produzidos": return {
      label: "PRODUZIDOS NO DIA",
      value: kpis.pedidosProduzidos,
      sub: "Têm Dt. Conf. Sep.",
      pctVal: "",
    };
    case "separados": return {
      label: "SEPARADOS 100%",
      value: kpis.pedidosSep,
      sub: `de ${total} pedidos`,
      pctVal: pctFn(kpis.pedidosSep, total),
    };
    case "checkout": return {
      label: "CHECKOUT 100%",
      value: kpis.pedidosCko,
      sub: `${(kpis.linhasCko ?? 0).toLocaleString("pt-BR")} linhas`,
      pctVal: pctFn(kpis.pedidosCko, total),
    };
    case "embarcados": return {
      label: "EMBARCADOS",
      value: kpis.expedidos,
      sub: "Sit. Fase = Emb. Conf.",
      pctVal: pctFn(kpis.expedidos, total),
    };
    case "itens": return {
      label: "TOTAL DE ITENS",
      value: kpis.unidades,
      sub: `${(kpis.linhas ?? 0).toLocaleString("pt-BR")} linhas WKU`,
      pctVal: "",
    };
    case "skus": return {
      label: "SKUs DISTINTOS",
      value: kpis.skus,
      sub: "produtos únicos no dia",
      pctVal: "",
    };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// EXPORTAÇÃO PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════════
export async function exportDashboardExcel(data: {
  wku: WkuRow[];
  wxd: WxdRow[];
  kpis: any;
  faseMap: Map<string, string>;
  kpiOrder?: KpiId[];
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Bralog Dashboard";
  wb.created = new Date();

  const order: KpiId[] = data.kpiOrder ?? [
    "produzidos", "separados", "checkout", "embarcados", "itens", "skus",
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // ABA 1 ─ RESUMO OPERACIONAL
  // ═══════════════════════════════════════════════════════════════════════════
  const ws1 = wb.addWorksheet("Resumo Operacional", { views: [{ showGridLines: false }] });
  pageHeader(ws1, "Dashboard Operacional", "Resumo Geral · KPIs do Dia · Relatório Ápice/Beauty", 6);

  // ── KPI Cards (segue a ordem do dashboard) ─────────────────────────────────
  sectionTitle(ws1, 7, "KPIs DO DIA  —  na ordem que você organizou", 6, G.deep);
  ws1.getRow(8).height = 6;

  // Cada KPI ocupa 3 linhas: label | valor | sub+pct
  // Dois por linha (3 colunas cada), em 3 pares
  const pairs = [
    [order[0], order[1]],
    [order[2], order[3]],
    [order[4], order[5]],
  ].filter(p => p.some(Boolean));

  let kpiRow = 9;
  for (const pair of pairs) {
    ws1.getRow(kpiRow).height = 14;
    ws1.getRow(kpiRow + 1).height = 30;
    ws1.getRow(kpiRow + 2).height = 13;

    for (let side = 0; side < 2; side++) {
      const id = pair[side] as KpiId | undefined;
      if (!id) continue;
      const kpi = getKpiData(id, data.kpis, pct);
      const startCol = side === 0 ? 1 : 4;     // A ou D
      const endCol   = side === 0 ? 3 : 6;
      const colLetter = (n: number) => String.fromCharCode(64 + n);

      // Label row
      ws1.mergeCells(kpiRow, startCol, kpiRow, endCol);
      const lc = ws1.getCell(kpiRow, startCol);
      lc.value = kpi.label;
      lc.fill = fill(G.forest);
      lc.font = font(G.mint, 9, true);
      lc.alignment = align("center", "middle");
      lc.border = border(G.deep, "medium");

      // Value row
      ws1.mergeCells(kpiRow + 1, startCol, kpiRow + 1, endCol);
      const vc = ws1.getCell(kpiRow + 1, startCol);
      vc.value = kpi.value;
      vc.fill = fill(id === "embarcados" ? G.goldPale : G.boxBg);
      vc.font = font(id === "embarcados" ? G.gold : G.deep, 22, true);
      vc.alignment = align("center", "middle");
      vc.border = border(id === "embarcados" ? G.goldMid : G.borderMd, "medium");

      // Sub row
      ws1.mergeCells(kpiRow + 2, startCol, kpiRow + 2, endCol);
      const sc = ws1.getCell(kpiRow + 2, startCol);
      sc.value = kpi.pctVal ? `${kpi.sub}  ·  ${kpi.pctVal}` : kpi.sub;
      sc.fill = fill(G.mint);
      sc.font = font(G.sage, 9, false, true);
      sc.alignment = align("center", "middle");
      sc.border = border(G.border);
    }
    kpiRow += 4; // 3 linhas + 1 espaço
  }

  // ── Relatório Ápice/Beauty ──────────────────────────────────────────────────
  const abStart = kpiRow + 1;
  sectionTitle(ws1, abStart, "RELATÓRIO  —  CAIXA FECHADA vs FRAÇÃO  ·  ÁPICE E BEAUTY", 6, G.deep);
  let r = abStart + 2;

  if (data.kpis.relatorioAB?.length > 0) {
    for (const rel of data.kpis.relatorioAB) {
      // Nome do cliente
      ws1.mergeCells(`B${r}:E${r}`);
      const nc = ws1.getCell(`B${r}`);
      nc.value = rel.cliente;
      nc.fill = fill(G.forest);
      nc.font = font(G.white, 11, true);
      nc.alignment = align("center", "middle");
      nc.border = border(G.deep, "medium");
      ws1.getRow(r).height = 20;
      r++;

      // Cabeçalhos
      tableHeader(ws1, r, [null, "TIPO", "Nº PEDIDOS", "% DO TOTAL", null, null], G.pine);
      r++;

      const rowData: [string, number, string][] = [
        ["Caixa Fechada", rel.caixa, pct(rel.caixa, rel.total)],
        ["Fração",        rel.fracao, pct(rel.fracao, rel.total)],
      ];
      const rowBgs = [G.boxBg, G.fracBg];
      const rowFgs = [G.boxText, G.fracText];

      rowData.forEach(([label, val, p], i) => {
        [2, 3, 4].forEach(col => {
          const vals: Record<number, string | number> = { 2: label, 3: val, 4: p };
          const c = ws1.getCell(r, col);
          c.value = vals[col];
          c.fill = fill(rowBgs[i]);
          c.font = font(rowFgs[i], 10, col === 2);
          c.alignment = align("center", "middle");
          c.border = border(G.border);
        });
        ws1.getRow(r).height = 17;
        r++;
      });

      // Total
      [2, 3, 4].forEach(col => {
        const vals: Record<number, string | number> = { 2: "TOTAL", 3: rel.total, 4: "100.0%" };
        const c = ws1.getCell(r, col);
        c.value = vals[col];
        c.fill = fill(G.forest);
        c.font = font(G.white, 10, true);
        c.alignment = align("center", "middle");
        c.border = border(G.deep, "medium");
      });
      ws1.getRow(r).height = 18;
      r += 3;
    }
  } else {
    ws1.mergeCells(`A${r}:F${r}`);
    const nd = ws1.getCell(`A${r}`);
    nd.value = "Não há pedidos Ápice/Beauty neste relatório.";
    nd.font = font(G.muted, 10, false, true);
    nd.alignment = align("center");
  }

  // Larguras aba 1
  [5, 28, 20, 20, 28, 5].forEach((w, i) => { ws1.getColumn(i + 1).width = w; });

  // ═══════════════════════════════════════════════════════════════════════════
  // ABA 2 ─ DETALHAMENTO ÁPICE · BEAUTY  (com qtd real)
  // ═══════════════════════════════════════════════════════════════════════════
  const ws2 = wb.addWorksheet("Detalhamento Ápice·Beauty", { views: [{ showGridLines: false }] });
  pageHeader(ws2, "Detalhamento por Pedido — Ápice e Beauty", "Caixas Fechadas · Frações · Fator · Total Real de Itens", 6);

  tableHeader(ws2, 7, ["Pedido", "Cliente", "Caixas Fechadas", "Unidades Fracionadas", "Fator", "Total de Itens"], G.forest);
  ws2.autoFilter = "A7:F7";

  const APICE_BEAUTY = /apice|ápice|beauty/i;
  const abMap = new Map<string, { cliente: string; caixas: number; fracao: number; qtd: number; fatores: Set<number> }>();
  for (const r2 of data.wku) {
    if (!r2.cliente || !APICE_BEAUTY.test(r2.cliente) || !r2.pedido) continue;
    const cur = abMap.get(r2.pedido) ?? { cliente: r2.cliente, caixas: 0, fracao: 0, qtd: 0, fatores: new Set<number>() };
    cur.caixas += r2.caixas || 0;
    cur.fracao += r2.fracionado || 0;
    cur.qtd   += r2.qt_item || 0;
    if (r2.fator_caixa > 1) cur.fatores.add(r2.fator_caixa);
    abMap.set(r2.pedido, cur);
  }
  const abList = Array.from(abMap.entries())
    .map(([pedido, v]) => ({ pedido, ...v }))
    .sort((a, b) => a.cliente.localeCompare(b.cliente) || a.pedido.localeCompare(b.pedido));

  abList.forEach((p, idx) => {
    const fatorStr = p.fatores.size > 0 ? Array.from(p.fatores).join(", ") : "1";
    addDataRow(ws2, [p.pedido, p.cliente, p.caixas, p.fracao, fatorStr, p.qtd], idx, {
      3: { bg: p.caixas > 0 ? G.boxBg : undefined, fg: p.caixas > 0 ? G.boxText : undefined, hAlign: "center" },
      4: { bg: p.fracao > 0 ? G.fracBg : undefined, fg: p.fracao > 0 ? G.fracText : undefined, hAlign: "center" },
      5: { hAlign: "center" },
      6: { bg: G.boxBg, fg: G.deep, bold: true, hAlign: "center" },
    });
  });

  if (abList.length === 0) {
    const emptyRow = ws2.addRow(["Nenhum pedido encontrado.", "", "", "", "", ""]);
    emptyRow.getCell(1).font = font(G.muted, 10, false, true);
  }

  [20, 48, 18, 20, 15, 20].forEach((w, i) => { ws2.getColumn(i + 1).width = w; });

  // ═══════════════════════════════════════════════════════════════════════════
  // ABA 3 ─ CONSOLIDAÇÃO POR SKU
  // ═══════════════════════════════════════════════════════════════════════════
  const ws3 = wb.addWorksheet("Consolidação por SKU", { views: [{ showGridLines: false }] });
  pageHeader(ws3, "Consolidação por SKU", "Top SKUs por Quantidade Total de Itens", 4);

  tableHeader(ws3, 7, ["SKU", "Produto / Descrição", "Nº Pedidos", "Qtd. Total de Itens"], G.forest);
  ws3.autoFilter = "A7:D7";

  const mapSku = new Map<string, { nome: string; qt: number; pedidos: Set<string> }>();
  for (const rr of data.wku) {
    if (!rr.sku) continue;
    const cur = mapSku.get(rr.sku) ?? { nome: rr.nome ?? "", qt: 0, pedidos: new Set() };
    cur.qt += rr.qt_item || 0;
    if (rr.pedido) cur.pedidos.add(rr.pedido);
    mapSku.set(rr.sku, cur);
  }
  Array.from(mapSku.entries())
    .sort((a, b) => b[1].qt - a[1].qt)
    .forEach(([sku, v], idx) => {
      addDataRow(ws3, [sku, v.nome, v.pedidos.size, v.qt], idx, {
        4: { bold: true, hAlign: "center" },
      });
    });

  [18, 60, 14, 20].forEach((w, i) => { ws3.getColumn(i + 1).width = w; });

  // ═══════════════════════════════════════════════════════════════════════════
  // ABA 4 ─ DETALHES POR PEDIDO (todos os clientes)
  // ═══════════════════════════════════════════════════════════════════════════
  const ws4 = wb.addWorksheet("Detalhes por Pedido", { views: [{ showGridLines: false }] });
  pageHeader(ws4, "Detalhes por Pedido", "Todos os Clientes · Separação · Checkout · Situação de Fase", 5);

  tableHeader(ws4, 7, ["Pedido", "Cliente", "Sep 100% (itens)", "Cko 100% (itens)", "Situação de Fase"], G.forest);
  ws4.autoFilter = "A7:E7";

  const mapPed = new Map<string, { cliente: string; sep: number; cko: number; linhas: number }>();
  for (const rr of data.wku) {
    if (!rr.pedido) continue;
    const cur = mapPed.get(rr.pedido) ?? { cliente: rr.cliente ?? "", sep: 0, cko: 0, linhas: 0 };
    cur.linhas++;
    if (rr.pct_sep === 100) cur.sep++;
    if (rr.pct_cko === 100) cur.cko++;
    mapPed.set(rr.pedido, cur);
  }
  Array.from(mapPed.entries())
    .sort((a, b) => b[1].linhas - a[1].linhas)
    .forEach(([pedido, v], idx) => {
      const fase = data.faseMap.get(pedido) ?? "—";
      const isEmb = fase === "Emb. Conf.";
      addDataRow(ws4, [pedido, v.cliente, v.sep, v.cko, fase], idx, {
        5: {
          bg: isEmb ? G.boxBg : undefined,
          fg: isEmb ? G.deep : undefined,
          bold: isEmb,
          hAlign: "center",
        },
      });
    });

  [20, 48, 18, 18, 22].forEach((w, i) => { ws4.getColumn(i + 1).width = w; });

  // ─── Download ──────────────────────────────────────────────────────────────
  const buf = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `Bralog_Operacional_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}
