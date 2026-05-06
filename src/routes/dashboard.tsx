import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { loadUpload, type WxdRow, type WkuRow } from "@/lib/loadUpload";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  BarChart3, Boxes, CheckCheck, History, Package, PackageCheck,
  Truck, Upload, Layers, Tag, Calendar, Sparkles, ClipboardList, Download,
} from "lucide-react";
import { exportDashboardExcel } from "@/lib/exportExcel";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  validateSearch: z.object({ id: z.string().optional() }),
});

type UploadRow = { id: string; uploaded_at: string; reference_date: string | null; wku_count: number };

const APICE_BEAUTY = /apice|ápice|beauty/i;

function KpiCard({
  icon: Icon, label, value, sub, progress, gold,
  cardDragProps,
}: {
  icon: typeof BarChart3; label: string; value: string; sub?: string;
  progress?: number; gold?: boolean;
  cardDragProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  return (
    <Card
      className="relative overflow-hidden p-5 border-border/60 h-full flex flex-col"
      style={{
        background: "var(--gradient-luxe)",
        boxShadow: "var(--shadow-luxe)",
        cursor: cardDragProps ? "grab" : undefined,
      }}
      {...(cardDragProps as React.HTMLAttributes<HTMLDivElement>)}
    >
      <div className="absolute inset-0 opacity-[0.04]" style={{ background: "var(--gradient-primary)" }} />
      {cardDragProps && (
        <div className="absolute top-2 right-2 opacity-30 select-none text-[11px] text-muted-foreground flex items-center gap-0.5">
          <span title="Arraste para mover">⠇</span>
        </div>
      )}
      <div className="relative flex items-start justify-between gap-3 flex-1">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">
            {label}
          </div>
          <div className="text-3xl font-bold mt-2 tabular-nums tracking-tight">{value}</div>
          {sub && <div className="text-xs text-muted-foreground mt-1.5">{sub}</div>}
        </div>
        <div
          className="p-2.5 rounded-lg shrink-0"
          style={{
            background: gold ? "var(--gradient-gold)" : "var(--gradient-primary)",
            boxShadow: gold ? undefined : "var(--shadow-glow)",
          }}
        >
          <Icon className="size-5 text-primary-foreground" />
        </div>
      </div>
      {progress !== undefined && (
        <div className="relative mt-4">
          <Progress value={progress} className="h-2" />
          <div className="text-[10px] text-muted-foreground mt-1.5 text-right tabular-nums">
            {progress.toFixed(1)}%
          </div>
        </div>
      )}
    </Card>
  );
}

function DashboardPage() {
  const { id } = Route.useSearch();
  const nav = useNavigate();

  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [selected, setSelected] = useState<string | null>(id ?? null);
  const [loading, setLoading] = useState(false);
  const [wku, setWku] = useState<WkuRow[]>([]);
  const [wxd, setWxd] = useState<WxdRow[]>([]);

  const [search, setSearch] = useState("");
  const [clienteFilter, setClienteFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Drag-and-drop state for KPI cards
  type KpiId = "produzidos" | "separados" | "checkout" | "embarcados" | "itens" | "skus";
  const DEFAULT_ORDER: KpiId[] = ["produzidos", "separados", "checkout", "embarcados", "itens", "skus"];
  const [kpiOrder, setKpiOrder] = useState<KpiId[]>(DEFAULT_ORDER);
  const dragSrc = useRef<KpiId | null>(null);
  const onDragStart = useCallback((id: KpiId) => { dragSrc.current = id; }, []);
  const onDrop = useCallback((target: KpiId) => {
    if (!dragSrc.current || dragSrc.current === target) return;
    setKpiOrder(prev => {
      const next = [...prev];
      const si = next.indexOf(dragSrc.current!);
      const ti = next.indexOf(target);
      next.splice(si, 1);
      next.splice(ti, 0, dragSrc.current!);
      dragSrc.current = null;
      return next;
    });
  }, []);

  useEffect(() => {
    supabase
      .from("uploads")
      .select("id,created_at,reference_date,wku_count")
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (data) {
          const rows = data.map(u => ({
            id: u.id,
            uploaded_at: u.created_at || "",
            reference_date: u.reference_date,
            wku_count: u.wku_count
          }));
          setUploads(rows);
          if (!selected && rows[0]) setSelected(rows[0].id);
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    loadUpload(selected)
      .then(({ wku, wxd }) => { setWku(wku); setWxd(wxd); })
      .finally(() => setLoading(false));
  }, [selected]);

  const faseMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of wxd) if (r.pedido) m.set(r.pedido, r.sit_fase ?? "");
    return m;
  }, [wxd]);

  const clientes = useMemo(
    () => Array.from(new Set(wku.map((r) => r.cliente).filter(Boolean) as string[])).sort(),
    [wku],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return wku.filter((r) => {
      if (clienteFilter !== "all" && r.cliente !== clienteFilter) return false;
      if (q && !`${r.pedido ?? ""} ${r.sku ?? ""} ${r.nome ?? ""}`.toLowerCase().includes(q)) return false;
      if (statusFilter !== "all") {
        const fase = r.pedido ? faseMap.get(r.pedido) : undefined;
        if (statusFilter === "sep" && r.pct_sep !== 100) return false;
        if (statusFilter === "cko" && r.pct_cko !== 100) return false;
        if (statusFilter === "exp" && fase !== "Emb. Conf.") return false;
        if (statusFilter === "pendente" && r.pct_sep === 100) return false;
      }
      return true;
    });
  }, [wku, search, clienteFilter, statusFilter, faseMap]);

  const filteredWxd = useMemo(() => {
    const q = search.trim().toLowerCase();
    return wxd.filter((r) => {
      if (clienteFilter !== "all" && r.cliente !== clienteFilter) return false;
      if (q && !`${r.pedido ?? ""} ${r.sit_fase ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [wxd, search, clienteFilter]);

  // KPIs principais
  const kpis = useMemo(() => {
    const linhas = filtered.length;
    const linhasSep = filtered.filter((r) => r.pct_sep === 100).length;
    const linhasCko = filtered.filter((r) => r.pct_cko === 100).length;
    const pedidosSet = new Set(filtered.map((r) => r.pedido).filter(Boolean) as string[]);
    const pedidosSepSet = new Set(
      filtered.filter((r) => r.pct_sep === 100).map((r) => r.pedido).filter(Boolean) as string[],
    );
    const pedidosCkoSet = new Set(
      filtered.filter((r) => r.pct_cko === 100).map((r) => r.pedido).filter(Boolean) as string[],
    );
    const pedidosProduzidos = new Set(
      filtered.filter((r) => r.dt_conf_sep).map((r) => r.pedido).filter(Boolean) as string[],
    );
    const pedidos = pedidosSet.size;
    const pedidosSep = pedidosSepSet.size;
    const pedidosCko = pedidosCkoSet.size;
    const skus = new Set(filtered.map((r) => r.sku).filter(Boolean)).size;
    const unidades = filtered.reduce((a, r) => a + (r.qt_item || 0), 0);
    const expedidos = Array.from(pedidosSet).filter((p) => faseMap.get(p) === "Emb. Conf.").length;

    // Caixas vs Fração — só APICE/BEAUTY
    const ab = filtered.filter((r) => r.cliente && APICE_BEAUTY.test(r.cliente));
    const caixasFechadas = ab.reduce((a, r) => a + (r.caixas || 0), 0);
    const unidFracionadas = ab.reduce((a, r) => a + (r.fracionado || 0), 0);

    // % pedidos com fração x % com só caixa fechada (separado por cliente)
    const abOrders = new Map<string, Map<string, { temFracao: boolean; temCaixa: boolean }>>();
    
    for (const r of ab) {
      if (!r.pedido || !r.cliente) continue;
      const c = r.cliente.toUpperCase();
      let clientMap = abOrders.get(c);
      if (!clientMap) {
        clientMap = new Map();
        abOrders.set(c, clientMap);
      }
      const cur = clientMap.get(r.pedido) ?? { temFracao: false, temCaixa: false };
      if ((r.fracionado || 0) > 0) cur.temFracao = true;
      if ((r.caixas || 0) > 0) cur.temCaixa = true;
      clientMap.set(r.pedido, cur);
    }

    const relatorioAB = Array.from(abOrders.entries()).map(([cliente, map]) => {
      let caixa = 0;
      let fracao = 0;
      for (const v of map.values()) {
        if (v.temFracao) fracao++;
        else if (v.temCaixa) caixa++;
      }
      return { cliente, caixa, fracao, total: caixa + fracao };
    });

    // Detalhamento por PEDIDO (Apice/Beauty) — caixas e frações por pedido
    const abPedidosMap = new Map<string, { cliente: string; caixas: number; fracao: number; qtd: number }>();
    for (const r of ab) {
      if (!r.pedido) continue;
      const cur = abPedidosMap.get(r.pedido) ?? { cliente: r.cliente ?? "", caixas: 0, fracao: 0, qtd: 0 };
      cur.caixas += r.caixas || 0;
      cur.fracao += r.fracionado || 0;
      cur.qtd += r.qt_item || 0;  // total real de itens (unidades) do pedido
      abPedidosMap.set(r.pedido, cur);
    }
    const abPedidos = Array.from(abPedidosMap.entries())
      .map(([pedido, v]) => ({ pedido, ...v }))
      .sort((a, b) => a.cliente.localeCompare(b.cliente) || a.pedido.localeCompare(b.pedido));

    return {
      linhas, linhasSep, linhasCko,
      pedidos, pedidosSep, pedidosCko, pedidosProduzidos: pedidosProduzidos.size,
      skus, unidades, expedidos,
      caixasFechadas, unidFracionadas,
      relatorioAB, abPedidos,
    };
  }, [filtered, faseMap]);

  const porHora = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) {
      if (!r.dt_conf_sep || r.pct_sep !== 100) continue;
      const h = new Date(r.dt_conf_sep).toISOString().slice(0, 13) + ":00";
      m.set(h, (m.get(h) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ hora: k.slice(11, 16), separado: v }));
  }, [filtered]);

  const topSkus = useMemo(() => {
    const m = new Map<string, { qt: number; nome: string }>();
    for (const r of filtered) {
      if (!r.sku) continue;
      const cur = m.get(r.sku) ?? { qt: 0, nome: r.nome ?? "" };
      cur.qt += r.qt_item || 0;
      m.set(r.sku, cur);
    }
    return Array.from(m.entries())
      .map(([sku, v]) => ({ sku, ...v }))
      .sort((a, b) => b.qt - a.qt)
      .slice(0, 15);
  }, [filtered]);

  const topClientes = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) {
      if (!r.cliente || !r.pedido) continue;
      const k = r.cliente;
      const set = (m.get(k) as unknown as Set<string>) ?? new Set<string>();
      set.add(r.pedido);
      m.set(k, set as unknown as number);
    }
    return Array.from(m.entries())
      .map(([cliente, set]) => ({ cliente, pedidos: (set as unknown as Set<string>).size }))
      .sort((a, b) => b.pedidos - a.pedidos)
      .slice(0, 8);
  }, [filtered]);

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

  const pedidosTable = useMemo(() => {
    const map = new Map<
      string,
      { pedido: string; cliente: string; linhas: number; sep: number; cko: number; caixas: number; und: number; fase: string }
    >();
    for (const r of filtered) {
      const p = r.pedido ?? "—";
      const cur = map.get(p) ?? {
        pedido: p, cliente: r.cliente ?? "",
        linhas: 0, sep: 0, cko: 0, caixas: 0, und: 0,
        fase: faseMap.get(p) ?? "—",
      };
      cur.linhas++;
      if (r.pct_sep === 100) cur.sep++;
      if (r.pct_cko === 100) cur.cko++;
      cur.caixas += r.caixas || 0;
      cur.und += r.fracionado || 0;
      map.set(p, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.linhas - a.linhas).slice(0, 200);
  }, [filtered, faseMap]);

  const C = {
    primary: "oklch(0.65 0.15 155)",
    glow: "oklch(0.78 0.18 152)",
    gold: "oklch(0.82 0.16 88)",
    red: "oklch(0.55 0.18 25)",
    blue: "oklch(0.55 0.10 200)",
  };
  const PIE = [C.primary, C.gold];

  return (
    <div className="min-h-screen bg-background">
      <header
        className="border-b border-border/60 sticky top-0 z-10 backdrop-blur"
        style={{ background: "color-mix(in oklab, var(--background) 90%, transparent)" }}
      >
        <div className="max-w-[1500px] mx-auto px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2.5 font-bold tracking-tight">
            <div
              className="size-8 rounded-lg flex items-center justify-center"
              style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
            >
              <Sparkles className="size-4 text-primary-foreground" />
            </div>
            <div>
              <div className="text-sm leading-tight">BRALOG</div>
              <div className="text-[10px] text-muted-foreground tracking-widest uppercase">
                Painel Operacional
              </div>
            </div>
          </div>
          <div className="flex-1" />
          {uploads.length > 0 && (
            <Select value={selected ?? ""} onValueChange={(v) => setSelected(v)}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Selecionar upload" />
              </SelectTrigger>
              <SelectContent>
                {uploads.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.reference_date ?? new Date(u.uploaded_at).toLocaleDateString("pt-BR")} ·{" "}
                    {u.wku_count} linhas
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
            onClick={() => exportDashboardExcel({ wku: filtered, wxd: filteredWxd, kpis, faseMap, kpiOrder })}
            disabled={!selected || loading}
          >
            <Download className="size-4" /> Exportar Planilha
          </Button>
          <Button variant="outline" asChild>
            <Link to="/historico"><History className="size-4" />Histórico</Link>
          </Button>
          <Button onClick={() => nav({ to: "/upload" })}>
            <Upload className="size-4" />Novo upload
          </Button>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto px-6 py-6 space-y-6">
        {!selected && uploads.length === 0 && (
          <Card className="p-16 text-center" style={{ background: "var(--gradient-luxe)" }}>
            <div
              className="size-16 mx-auto rounded-full flex items-center justify-center mb-4"
              style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
            >
              <Upload className="size-7 text-primary-foreground" />
            </div>
            <h2 className="text-2xl font-bold">Nenhum upload ainda</h2>
            <p className="text-muted-foreground mt-2">
              Envie suas planilhas WKU, WMG (Apice/Beauty) e WXD para começar.
            </p>
            <Button className="mt-6" size="lg" asChild>
              <Link to="/upload">Fazer primeiro upload</Link>
            </Button>
          </Card>
        )}

        {selected && (
          <>
            <Card className="p-4 flex flex-wrap gap-3 items-center">
              <Input
                placeholder="Buscar pedido, SKU ou nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
              />
              <Select value={clienteFilter} onValueChange={setClienteFilter}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {clientes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="sep">Separados (100%)</SelectItem>
                  <SelectItem value="cko">Em checkout (100%)</SelectItem>
                  <SelectItem value="exp">Expedidos (Emb. Conf.)</SelectItem>
                  <SelectItem value="pendente">Pendentes</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex-1" />
              <div className="text-xs text-muted-foreground">
                {kpis.linhas.toLocaleString("pt-BR")} linhas · {kpis.pedidos.toLocaleString("pt-BR")} pedidos
              </div>
            </Card>

            <Tabs defaultValue="overview" className="w-full space-y-6">
              <TabsList className="bg-muted/50 p-1">
                <TabsTrigger value="overview" className="gap-2">
                  <BarChart3 className="size-4" /> Resumo Geral
                </TabsTrigger>
                <TabsTrigger value="expedicao" className="gap-2">
                  <Truck className="size-4" /> Expedição (WXD)
                </TabsTrigger>
                <TabsTrigger value="pedidos" className="gap-2">
                  <ClipboardList className="size-4" /> Detalhes por Pedido
                </TabsTrigger>
                <TabsTrigger value="produtos" className="gap-2">
                  <Boxes className="size-4" /> Produtos e Clientes
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                {loading ? (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
                  </div>
                ) : (
                  <>
                     {/* Cards KPI — clique e segure para arrastar */}
                    <div>
                      <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-3 flex items-center gap-2">
                        <Package className="size-3.5" /> KPIs — clique e arraste para reordenar
                      </h2>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
                        {kpiOrder.map((id) => {
                          const cardDragProps = {
                            draggable: true,
                            onDragStart: () => onDragStart(id),
                            onDragOver: (e: React.DragEvent) => e.preventDefault(),
                            onDrop: () => onDrop(id),
                          };
                          if (id === "produzidos") return (
                            <KpiCard key={id} icon={Calendar} label="Produzidos no dia" value={kpis.pedidosProduzidos.toLocaleString("pt-BR")} sub="Têm Dt. Conf. Sep." cardDragProps={cardDragProps} />
                          );
                          if (id === "separados") return (
                            <KpiCard key={id} icon={CheckCheck} label="Separados (% Sep = 100)" value={kpis.pedidosSep.toLocaleString("pt-BR")} sub={`de ${kpis.pedidos} total`} progress={pct(kpis.pedidosSep, kpis.pedidos)} cardDragProps={cardDragProps} />
                          );
                          if (id === "checkout") return (
                            <KpiCard key={id} icon={PackageCheck} label="Checkout (% Cko = 100)" value={kpis.pedidosCko.toLocaleString("pt-BR")} sub={`${kpis.linhasCko.toLocaleString("pt-BR")} linhas`} progress={pct(kpis.pedidosCko, kpis.pedidos)} cardDragProps={cardDragProps} />
                          );
                          if (id === "embarcados") return (
                            <KpiCard key={id} icon={Truck} label="Embarcados (Emb. Conf.)" value={kpis.expedidos.toLocaleString("pt-BR")} sub="Sit. Fase = Emb. Conf." progress={pct(kpis.expedidos, kpis.pedidos)} gold cardDragProps={cardDragProps} />
                          );
                          if (id === "itens") return (
                            <KpiCard key={id} icon={Tag} label="Total de itens (Qt. Ítem)" value={kpis.unidades.toLocaleString("pt-BR")} sub={`${kpis.linhas.toLocaleString("pt-BR")} linhas WKU`} cardDragProps={cardDragProps} />
                          );
                          if (id === "skus") return (
                            <KpiCard key={id} icon={Boxes} label="SKUs distintos (Cód. Merc.)" value={kpis.skus.toLocaleString("pt-BR")} sub="produtos únicos no dia" cardDragProps={cardDragProps} />
                          );
                          return null;
                        })}
                      </div>
                    </div>

                    {/* Funil */}
                    <Card className="p-6">
                      <h3 className="font-semibold mb-4">Funil da operação (pedidos)</h3>
                      <div className="space-y-3">
                        {[
                          { label: "Total de pedidos", v: kpis.pedidos, color: "color-mix(in oklab, var(--muted-foreground) 50%, transparent)" },
                          { label: "Produzidos (têm Dt. Sep.)", v: kpis.pedidosProduzidos, color: C.blue },
                          { label: "Separados 100%", v: kpis.pedidosSep, color: C.primary },
                          { label: "Checkout 100%", v: kpis.pedidosCko, color: C.glow },
                          { label: "Embarcados (Emb. Conf.)", v: kpis.expedidos, color: C.gold },
                        ].map((s) => {
                          const p = pct(s.v, kpis.pedidos);
                          return (
                            <div key={s.label}>
                              <div className="flex items-center justify-between text-sm mb-1.5">
                                <span>{s.label}</span>
                                <span className="text-muted-foreground tabular-nums">
                                  {s.v.toLocaleString("pt-BR")} ({p}%)
                                </span>
                              </div>
                              <div className="h-3 rounded-full bg-muted/60 overflow-hidden">
                                <div
                                  className="h-full transition-all rounded-full"
                                  style={{ width: `${p}%`, background: s.color }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>

                    <Card className="p-6">
                      <h3 className="font-semibold mb-4">Separações por hora</h3>
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={porHora}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="hora" stroke="var(--muted-foreground)" fontSize={12} />
                          <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                          <Tooltip
                            contentStyle={{
                              background: "var(--card)",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                            }}
                          />
                          <Line
                            type="monotone" dataKey="separado"
                            stroke={C.primary} strokeWidth={2.5}
                            dot={{ fill: C.primary, r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </Card>
                  </>
                )}
              </TabsContent>

              <TabsContent value="expedicao" className="space-y-6">
                <Card className="p-0 overflow-hidden">
                  <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">Planilha de Expedição (WXD)</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Registros importados da planilha WXD
                      </p>
                    </div>
                    <div className="text-xs font-mono bg-muted px-2 py-1 rounded">
                      {wxd.length} registros
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pedido</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Situação Fase</TableHead>
                          <TableHead>Data Embarque</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredWxd.slice(0, 500).map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">{r.pedido}</TableCell>
                            <TableCell className="text-sm">{r.cliente}</TableCell>
                            <TableCell>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full ${
                                  r.sit_fase === "Emb. Conf." 
                                    ? "bg-primary/10 text-primary" 
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {r.sit_fase}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {r.dt_embarque ? new Date(r.dt_embarque).toLocaleString("pt-BR") : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredWxd.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                              Nenhum registro de expedição encontrado.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="pedidos" className="space-y-6">
                <Card className="p-0 overflow-hidden">
                  <div className="px-6 py-4 border-b border-border">
                    <h3 className="font-semibold">Pedidos detalhados</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Top 200 ordenados por nº de linhas
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pedido</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead className="text-right">Sep 100%</TableHead>
                          <TableHead className="text-right">Cko 100%</TableHead>
                          <TableHead>Sit. Fase</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pedidosTable.map((p) => (
                          <TableRow key={p.pedido}>
                            <TableCell className="font-mono text-xs">{p.pedido}</TableCell>
                            <TableCell className="text-sm max-w-[260px] truncate">{p.cliente}</TableCell>
                            <TableCell className="text-right tabular-nums">{p.sep}</TableCell>
                            <TableCell className="text-right tabular-nums">{p.cko}</TableCell>
                            <TableCell>
                              <span
                                className="text-xs px-2 py-0.5 rounded-full"
                                style={
                                  p.fase === "Emb. Conf."
                                    ? { background: "color-mix(in oklab, var(--primary) 20%, transparent)", color: "var(--primary)" }
                                    : { background: "var(--muted)", color: "var(--muted-foreground)" }
                                }
                              >
                                {p.fase}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="produtos" className="space-y-6">
                {/* Grade 2 colunas: Top Clientes + Tabelas Resumo */}
                <div className="grid lg:grid-cols-2 gap-6">
                  <Card className="p-6">
                    <h3 className="font-semibold mb-4">Top clientes (pedidos)</h3>
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={topClientes} layout="vertical" margin={{ left: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} />
                        <YAxis type="category" dataKey="cliente" stroke="var(--muted-foreground)" fontSize={11} width={140} tickFormatter={(v: string) => (v.length > 20 ? v.slice(0, 18) + "…" : v)} />
                        <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                        <Bar dataKey="pedidos" fill={C.primary} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                  {kpis.relatorioAB.length > 0 && (
                    <div className="space-y-4">
                      {kpis.relatorioAB.map((rel) => (
                        <div key={rel.cliente} className="rounded-lg overflow-hidden border border-border bg-card">
                          <div className="bg-[#1B4228] text-white py-2 text-center font-bold text-sm tracking-wide flex items-center justify-center gap-2">
                            <Package className="size-4" /> {rel.cliente}
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-[#2E593F] hover:bg-[#2E593F]">
                                <TableHead className="text-white text-center font-bold h-8">TIPO</TableHead>
                                <TableHead className="text-white text-center font-bold h-8 border-l border-[#1B4228]/20">Nº PEDIDOS</TableHead>
                                <TableHead className="text-white text-center font-bold h-8 border-l border-[#1B4228]/20">% DO TOTAL</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow style={{ background: "#C8E6C9" }} className="hover:brightness-[0.96]">
                                <TableCell className="text-center font-semibold text-[#0A2616] py-2">Caixa Fechada</TableCell>
                                <TableCell className="text-center font-medium text-[#0A2616] py-2 border-l border-[#A5D6A7] border-dashed">{rel.caixa}</TableCell>
                                <TableCell className="text-center font-medium text-[#0A2616] py-2 border-l border-[#A5D6A7] border-dashed">{pct(rel.caixa, rel.total).toFixed(1)}%</TableCell>
                              </TableRow>
                              <TableRow style={{ background: "#FFFFFF" }} className="hover:brightness-[0.97]">
                                <TableCell className="text-center font-semibold text-[#0A2616] py-2">Fração</TableCell>
                                <TableCell className="text-center font-medium text-[#0A2616] py-2 border-l border-gray-200 border-dashed">{rel.fracao}</TableCell>
                                <TableCell className="text-center font-medium text-[#0A2616] py-2 border-l border-gray-200 border-dashed">{pct(rel.fracao, rel.total).toFixed(1)}%</TableCell>
                              </TableRow>
                              <TableRow className="bg-[#2E593F] hover:bg-[#2E593F]">
                                <TableCell className="text-center font-bold text-white py-2">TOTAL</TableCell>
                                <TableCell className="text-center font-bold text-white py-2 border-l border-[#1B4228]/20">{rel.total}</TableCell>
                                <TableCell className="text-center font-bold text-white py-2 border-l border-[#1B4228]/20">100.0%</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Detalhamento por Pedido — LARGURA TOTAL, acima de Top SKUs */}
                {kpis.abPedidos.length > 0 && (
                  <div className="rounded-lg overflow-hidden border border-border bg-card">
                    <div className="bg-[#0A2616] text-white py-3 px-4 font-bold text-sm tracking-wide flex items-center gap-2">
                      <Package className="size-4" /> DETALHAMENTO POR PEDIDO — APICE E BEAUTY
                      <span className="ml-auto text-xs font-normal opacity-70">Caixas fechadas e unidades fracionadas por pedido</span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-[#2E593F] hover:bg-[#2E593F]">
                          <TableHead className="text-white font-bold">Pedido</TableHead>
                          <TableHead className="text-white font-bold">Cliente</TableHead>
                          <TableHead className="text-white font-bold text-center border-l border-[#1B4228]/30">Caixas Fechadas</TableHead>
                          <TableHead className="text-white font-bold text-center border-l border-[#1B4228]/30">Unidades Fracionadas</TableHead>
                          <TableHead className="text-white font-bold text-center border-l border-[#1B4228]/30">Total Itens</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {kpis.abPedidos.map((p, idx) => (
                          <TableRow key={p.pedido} style={{ background: idx % 2 === 0 ? "#FFFFFF" : "#F7FBF8" }} className="hover:brightness-[0.96]">
                            <TableCell className="font-mono text-xs text-[#0A2616] font-semibold">{p.pedido}</TableCell>
                            <TableCell className="text-sm text-[#1B4228]">{p.cliente}</TableCell>
                            <TableCell className="text-center">
                              <span className="inline-block bg-[#C8E6C9] text-[#0A2616] font-bold text-sm px-3 py-0.5 rounded-full">
                                {p.caixas > 0 ? p.caixas.toLocaleString("pt-BR") : "—"}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="inline-block bg-[#FFF3E0] text-[#7B4F00] font-bold text-sm px-3 py-0.5 rounded-full">
                                {p.fracao > 0 ? p.fracao.toLocaleString("pt-BR") : "—"}
                              </span>
                            </TableCell>
                            <TableCell className="text-center font-semibold text-[#0A2616]">
                              {p.qtd.toLocaleString("pt-BR")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {/* Top 15 SKUs */}
                <Card className="p-6">
                  <h3 className="font-semibold mb-4">Top 15 SKUs por quantidade de itens</h3>
                  <ResponsiveContainer width="100%" height={420}>
                    <BarChart data={topSkus} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} />
                      <YAxis type="category" dataKey="sku" stroke="var(--muted-foreground)" fontSize={11} width={100} />
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v: number, _n, p) => [v, (p.payload as { nome: string }).nome]} />
                      <Bar dataKey="qt" fill={C.primary} radius={[0, 4, 4, 0]} name="Itens" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}

