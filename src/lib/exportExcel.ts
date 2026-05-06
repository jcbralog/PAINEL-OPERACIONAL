import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { WkuRow, WxdRow } from "./loadUpload";

// Cores Bralog Premium
const C = {
  headerBg: "0A2616", // Verde luxo profundo
  headerFg: "FFFFFF",
  kpiBg: "E8F2EC", // Fundo super leve para KPIs
  kpiTitleFg: "143821",
  kpiValueFg: "0A2616",
  tableTitleBg: "123620", // Fundo do título da tabela
  tableHeaderBg: "1B4228", // Verde médio
  tableHeaderFg: "FFFFFF",
  rowAltBg: "F7FBF8",
  borderLight: "C1D5C8",
  goldBg: "B8860B", // Dourado Bralog
  goldFg: "FFFFFF"
};

export async function exportDashboardExcel(data: {
  wku: WkuRow[];
  wxd: WxdRow[];
  kpis: any;
  faseMap: Map<string, string>;
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Bralog Dashboard";
  wb.created = new Date();

  const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);

  // =========================================================
  // ABA 1: RESUMO & APICE/BEAUTY (Visão Premium)
  // =========================================================
  const ws1 = wb.addWorksheet("Resumo Operacional", {
    views: [{ showGridLines: false }],
  });

  // Cabeçalho Principal Luxuoso
  ws1.mergeCells("A1:E3");
  const t1 = ws1.getCell("A1");
  t1.value = "BRALOG LOGÍSTICA | DASHBOARD OPERACIONAL";
  t1.font = { name: "Segoe UI", size: 24, bold: true, color: { argb: C.headerFg } };
  t1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.headerBg } };
  t1.alignment = { vertical: "middle", horizontal: "center" };

  ws1.mergeCells("A4:E4");
  const sub1 = ws1.getCell("A4");
  sub1.value = `Relatório Gerado em ${new Date().toLocaleString("pt-BR")}`;
  sub1.font = { name: "Segoe UI", size: 10, italic: true, color: { argb: "E8F2EC" } };
  sub1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1B4228" } };
  sub1.alignment = { vertical: "middle", horizontal: "center" };

  // Bloco de KPIs (Removidos os dados brutos de caixa/fração que causavam confusão)
  const kpiHeaders = ["Total de SKUs", "Total de Pedidos", "Total de Itens", "Checkout 100%", "Expedidos"];
  const kpiValues = [
    data.kpis.skus,
    data.kpis.pedidos,
    data.kpis.unidades,
    data.kpis.pedidosCko,
    data.kpis.expedidos
  ];

  for (let i = 0; i < 5; i++) {
    const col = String.fromCharCode(65 + i); // A, B, C...
    const th = ws1.getCell(`${col}6`);
    th.value = kpiHeaders[i];
    th.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: C.kpiTitleFg } };
    th.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.kpiBg } };
    th.alignment = { vertical: "middle", horizontal: "center" };
    th.border = { top: { style: "thin", color: { argb: C.borderLight } }, left: { style: "thin", color: { argb: C.borderLight } }, right: { style: "thin", color: { argb: C.borderLight } } };

    const tv = ws1.getCell(`${col}7`);
    tv.value = kpiValues[i];
    tv.font = { name: "Segoe UI", size: 18, bold: true, color: { argb: C.kpiValueFg } };
    tv.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.kpiBg } };
    tv.alignment = { vertical: "middle", horizontal: "center" };
    tv.border = { bottom: { style: "thin", color: { argb: C.borderLight } }, left: { style: "thin", color: { argb: C.borderLight } }, right: { style: "thin", color: { argb: C.borderLight } } };
    
    ws1.getColumn(i + 1).width = 22;
  }

  // Seção Exclusiva: Relatório de Pedidos Caixa Fechada vs Fração (APICE / BEAUTY)
  ws1.getRow(9).height = 20;
  ws1.mergeCells("A9:E9");
  const abTitle = ws1.getCell("A9");
  abTitle.value = "  ► RELATÓRIO DE PEDIDOS: CAIXA FECHADA vs FRAÇÃO (APICE E BEAUTY)";
  abTitle.font = { name: "Segoe UI", size: 12, bold: true, color: { argb: C.goldFg } };
  abTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.tableTitleBg } };
  abTitle.alignment = { vertical: "middle", horizontal: "left" };

  let currentRow = 11;

  if (data.kpis.relatorioAB && data.kpis.relatorioAB.length > 0) {
    data.kpis.relatorioAB.forEach((rel: any) => {
      // Nome do Cliente
      ws1.mergeCells(`B${currentRow}:D${currentRow}`);
      const cName = ws1.getCell(`B${currentRow}`);
      cName.value = rel.cliente;
      cName.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FFFFFF" } };
      cName.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.tableHeaderBg } };
      cName.alignment = { vertical: "middle", horizontal: "center" };
      cName.border = { top: { style: "medium", color: { argb: C.tableTitleBg } }, bottom: { style: "medium", color: { argb: C.tableTitleBg } }, left: { style: "medium", color: { argb: C.tableTitleBg } }, right: { style: "medium", color: { argb: C.tableTitleBg } } };
      currentRow++;

      // Headers da Tabela
      const hdrs = ["TIPO", "Nº PEDIDOS", "% DO TOTAL"];
      hdrs.forEach((h, i) => {
        const cell = ws1.getCell(currentRow, i + 2); // Começa na coluna B
        cell.value = h;
        cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "2E593F" } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });
      currentRow++;

      // Linha Caixa Fechada
      ws1.getCell(currentRow, 2).value = "Caixa Fechada";
      ws1.getCell(currentRow, 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "C8E6C9" } };
      ws1.getCell(currentRow, 2).font = { bold: true, color: { argb: "0A2616" } };
      ws1.getCell(currentRow, 3).value = rel.caixa;
      ws1.getCell(currentRow, 3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "C8E6C9" } };
      ws1.getCell(currentRow, 4).value = `${pct(rel.caixa, rel.total).toFixed(1)}%`;
      ws1.getCell(currentRow, 4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "C8E6C9" } };
      ws1.getCell(currentRow, 3).alignment = { horizontal: "center" };
      ws1.getCell(currentRow, 4).alignment = { horizontal: "center" };
      currentRow++;

      // Linha Fração
      ws1.getCell(currentRow, 2).value = "Fração";
      ws1.getCell(currentRow, 3).value = rel.fracao;
      ws1.getCell(currentRow, 4).value = `${pct(rel.fracao, rel.total).toFixed(1)}%`;
      ws1.getCell(currentRow, 2).font = { bold: true, color: { argb: "0A2616" } };
      ws1.getCell(currentRow, 3).alignment = { horizontal: "center" };
      ws1.getCell(currentRow, 4).alignment = { horizontal: "center" };
      currentRow++;

      // Linha Total
      ws1.getCell(currentRow, 2).value = "TOTAL";
      ws1.getCell(currentRow, 3).value = rel.total;
      ws1.getCell(currentRow, 4).value = "100.0%";
      [2, 3, 4].forEach(col => {
        const c = ws1.getCell(currentRow, col);
        c.font = { name: "Segoe UI", bold: true, color: { argb: "FFFFFF" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "2E593F" } };
        c.alignment = { horizontal: "center" };
      });
      currentRow += 3; // Espaço para o próximo cliente
    });
  } else {
    ws1.mergeCells(`A11:E11`);
    const noData = ws1.getCell("A11");
    noData.value = "Não há pedidos para Apice e Beauty neste relatório.";
    noData.alignment = { horizontal: "center" };
    noData.font = { italic: true };
  }


  // =========================================================
  // ABA 2: CONSOLIDAÇÃO POR SKU
  // =========================================================
  const ws2 = wb.addWorksheet("Consolidação por SKU", { views: [{ showGridLines: false }] });

  ws2.mergeCells("A1:E3");
  const t2 = ws2.getCell("A1");
  t2.value = "BRALOG LOGÍSTICA | CONSOLIDAÇÃO POR SKU";
  t2.font = { name: "Segoe UI", size: 20, bold: true, color: { argb: C.headerFg } };
  t2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.headerBg } };
  t2.alignment = { vertical: "middle", horizontal: "center" };

  const skuCols = [
    { header: "SKU", key: "sku", width: 18 },
    { header: "Produto / Descrição", key: "nome", width: 60 },
    { header: "Nº Pedidos", key: "pedidos", width: 15 },
    { header: "Qtd. Total", key: "qtd", width: 15 },
  ];

  const skuRow = ws2.getRow(5);
  skuCols.forEach((col, i) => {
    const c = skuRow.getCell(i + 1);
    c.value = col.header;
    c.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: C.tableHeaderFg } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.tableHeaderBg } };
    c.alignment = { vertical: "middle", horizontal: "center" };
    c.border = { top: { style: "thin", color: { argb: C.borderLight } }, bottom: { style: "thin", color: { argb: C.borderLight } } };
    ws2.getColumn(i + 1).width = col.width;
  });

  // Habilitar filtros automáticos do Excel para a linha de cabeçalho
  ws2.autoFilter = 'A5:D5';

  const mapSku = new Map<string, { nome: string; qt: number; pedidos: Set<string>; sepCount: number }>();
  for (const r of data.wku) {
    if (!r.sku) continue;
    const cur = mapSku.get(r.sku) ?? { nome: r.nome ?? "", qt: 0, pedidos: new Set(), sepCount: 0 };
    cur.qt += r.qt_item || 0;
    if (r.pedido) cur.pedidos.add(r.pedido);
    if (r.pct_sep === 100) cur.sepCount++;
    mapSku.set(r.sku, cur);
  }

  const sortedSkus = Array.from(mapSku.entries()).sort((a, b) => b[1].qt - a[1].qt);

  sortedSkus.forEach(([sku, v], idx) => {
    const r = ws2.addRow([
      sku,
      v.nome,
      v.pedidos.size,
      v.qt
    ]);

    r.eachCell((c, i) => {
      c.font = { name: "Segoe UI", size: 10, color: { argb: "000000" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: idx % 2 === 0 ? "FFFFFF" : C.rowAltBg } };
      c.alignment = { vertical: "middle", horizontal: i === 2 ? "left" : "center" };
      c.border = { bottom: { style: "thin", color: { argb: "E0E0E0" } } };
    });
  });


  // =========================================================
  // ABA 3: DETALHES POR PEDIDO
  // =========================================================
  const ws3 = wb.addWorksheet("Detalhes por Pedido", { views: [{ showGridLines: false }] });
  
  ws3.mergeCells("A1:E3");
  const t3 = ws3.getCell("A1");
  t3.value = "BRALOG LOGÍSTICA | DETALHES POR PEDIDO";
  t3.font = { name: "Segoe UI", size: 20, bold: true, color: { argb: C.headerFg } };
  t3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.headerBg } };
  t3.alignment = { vertical: "middle", horizontal: "center" };

  const pedCols = [
    { header: "Pedido", key: "pedido", width: 20 },
    { header: "Cliente", key: "cliente", width: 45 },
    { header: "Sep 100% (Qtd. Itens)", key: "sep", width: 20 },
    { header: "Cko 100% (Qtd. Itens)", key: "cko", width: 20 },
    { header: "Situação Fase", key: "fase", width: 25 },
  ];

  const pRow = ws3.getRow(5);
  pedCols.forEach((col, i) => {
    const c = pRow.getCell(i + 1);
    c.value = col.header;
    c.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: C.tableHeaderFg } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.tableHeaderBg } };
    c.alignment = { vertical: "middle", horizontal: "center" };
    c.border = { top: { style: "thin", color: { argb: C.borderLight } }, bottom: { style: "thin", color: { argb: C.borderLight } } };
    ws3.getColumn(i + 1).width = col.width;
  });

  // Habilitar filtros para poder filtrar por Cliente, Pedido, etc.
  ws3.autoFilter = 'A5:E5';

  const mapPed = new Map<string, { cliente: string; linhas: number; sep: number; cko: number }>();
  for (const r of data.wku) {
    if (!r.pedido) continue;
    const cur = mapPed.get(r.pedido) ?? { cliente: r.cliente ?? "", linhas: 0, sep: 0, cko: 0 };
    cur.linhas++;
    if (r.pct_sep === 100) cur.sep++;
    if (r.pct_cko === 100) cur.cko++;
    mapPed.set(r.pedido, cur);
  }

  const sortedPeds = Array.from(mapPed.entries()).sort((a, b) => b[1].linhas - a[1].linhas);

  sortedPeds.forEach(([pedido, v], idx) => {
    const fase = data.faseMap.get(pedido) ?? "—";
    const r = ws3.addRow([
      pedido,
      v.cliente,
      v.sep,
      v.cko,
      fase
    ]);

    r.eachCell((c, i) => {
      c.font = { name: "Segoe UI", size: 10, color: { argb: "000000" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: idx % 2 === 0 ? "FFFFFF" : C.rowAltBg } };
      c.alignment = { vertical: "middle", horizontal: i === 2 ? "left" : "center" };
      c.border = { bottom: { style: "thin", color: { argb: "E0E0E0" } } };
    });
  });

  // =========================================================
  // ABA 4: EXPEDIÇÃO (WXD)
  // =========================================================
  const ws4 = wb.addWorksheet("Expedição", { views: [{ showGridLines: false }] });
  
  ws4.mergeCells("A1:D3");
  const t4 = ws4.getCell("A1");
  t4.value = "BRALOG LOGÍSTICA | PLANILHA DE EXPEDIÇÃO (WXD)";
  t4.font = { name: "Segoe UI", size: 20, bold: true, color: { argb: C.headerFg } };
  t4.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.headerBg } };
  t4.alignment = { vertical: "middle", horizontal: "center" };

  const wxdCols = [
    { header: "Pedido", key: "pedido", width: 20 },
    { header: "Cliente", key: "cliente", width: 45 },
    { header: "Situação Fase", key: "fase", width: 25 },
    { header: "Data Embarque", key: "data", width: 25 },
  ];

  const wxdRow = ws4.getRow(5);
  wxdCols.forEach((col, i) => {
    const c = wxdRow.getCell(i + 1);
    c.value = col.header;
    c.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: C.tableHeaderFg } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.tableHeaderBg } };
    c.alignment = { vertical: "middle", horizontal: "center" };
    c.border = { top: { style: "thin", color: { argb: C.borderLight } }, bottom: { style: "thin", color: { argb: C.borderLight } } };
    ws4.getColumn(i + 1).width = col.width;
  });

  ws4.autoFilter = 'A5:D5';

  data.wxd.forEach((r, idx) => {
    const row = ws4.addRow([
      r.pedido,
      r.cliente,
      r.sit_fase,
      r.dt_embarque ? new Date(r.dt_embarque).toLocaleString("pt-BR") : "—"
    ]);

    row.eachCell((c, i) => {
      c.font = { name: "Segoe UI", size: 10, color: { argb: "000000" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: idx % 2 === 0 ? "FFFFFF" : C.rowAltBg } };
      c.alignment = { vertical: "middle", horizontal: i === 2 ? "left" : "center" };
      c.border = { bottom: { style: "thin", color: { argb: "E0E0E0" } } };
    });
  });

  // Exportar e fazer Download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  saveAs(blob, `Bralog_Resumo_Operacional_${new Date().toISOString().slice(0,10)}.xlsx`);
}
