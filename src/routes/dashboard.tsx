import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  BarChart3, Boxes, CheckCheck, History, Package, PackageCheck,
  Truck, Upload, Layers, Tag, Calendar, Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  validateSearch: z.object({ id: z.string().optional() }),
});

type UploadRow = { id: string; uploaded_at: string; reference_date: string | null; wku_count: number };

const APICE_BEAUTY = /apice|beauty/i;

function KpiCard({
  icon: Icon, label, value, sub, progress, gold,
}: {
  icon: typeof BarChart3; label: string; value: string; sub?: string;
  progress?: number; gold?: boolean;
}) {
  return (
    <Card
      className="relative overflow-hidden p-5 border-border/60"
      style={{
        background: "var(--gradient-luxe)",
        boxShadow: "var(--shadow-luxe)",
      }}
    >
      <div className="absolute inset-0 opacity-[0.04]" style={{ background: "var(--gradient-primary)" }} />
      <div className="relative flex items-start justify-between gap-3">
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

  useEffect(() => {
    supabase
      .from("uploads")
      .select("id,uploaded_at,reference_date,wku_count")
      .order("uploaded_at", { ascending: false })
      .then(({ data }) => {
        const rows = (data ?? []) as UploadRow[];
        setUploads(rows);
        if (!selected && rows[0]) setSelected(rows[0].id);
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

    // % pedidos com fração x % com só caixa fechada (somente clientes A/B)
    const pedidosAB = new Map<string, { temFracao: boolean; temCaixa: boolean }>();
    for (const r of ab) {
      if (!r.pedido) continue;
      const cur = pedidosAB.get(r.pedido) ?? { temFracao: false, temCaixa: false };
      if ((r.fracionado || 0) > 0) cur.temFracao = true;
      if ((r.caixas || 0) > 0) cur.temCaixa = true;
      pedidosAB.set(r.pedido, cur);
    }
    let pedAB_caixaFechada = 0;
    let pedAB_fracionado = 0;
    for (const v of pedidosAB.values()) {
      if (v.temFracao) pedAB_fracionado++;
      else if (v.temCaixa) pedAB_caixaFechada++;
    }
    const pedAB_total = pedidosAB.size;

    return {
      linhas, linhasSep, linhasCko,
      pedidos, pedidosSep, pedidosCko, pedidosProduzidos: pedidosProduzidos.size,
      skus, unidades, expedidos,
      caixasFechadas, unidFracionadas,
      pedAB_caixaFechada, pedAB_fracionado, pedAB_total,
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

  const fracVsCaixa = useMemo(
    () => [
      { name: "Caixa fechada", value: kpis.pedAB_caixaFechada },
      { name: "Fracionado", value: kpis.pedAB_fracionado },
    ],
    [kpis],
  );

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

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

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

            {loading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
              </div>
            ) : (
              <>
                {/* Bloco PEDIDOS */}
                <div>
                  <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-3 flex items-center gap-2">
                    <Package className="size-3.5" /> Pedidos
                  </h2>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard
                      icon={Calendar} label="Produzidos no dia" value={kpis.pedidosProduzidos.toLocaleString("pt-BR")}
                      sub="Têm Dt. Conf. Sep."
                    />
                    <KpiCard
                      icon={CheckCheck} label="Separados (% Sep = 100)"
                      value={kpis.pedidosSep.toLocaleString("pt-BR")}
                      sub={`de ${kpis.pedidos} total`}
                      progress={pct(kpis.pedidosSep, kpis.pedidos)}
                    />
                    <KpiCard
                      icon={PackageCheck} label="Checkout (% Cko = 100)"
                      value={kpis.pedidosCko.toLocaleString("pt-BR")}
                      sub={`${kpis.linhasCko.toLocaleString("pt-BR")} linhas`}
                      progress={pct(kpis.pedidosCko, kpis.pedidos)}
                    />
                    <KpiCard
                      icon={Truck} label="Embarcados (Emb. Conf.)"
                      value={kpis.expedidos.toLocaleString("pt-BR")}
                      sub="Sit. Fase = Emb. Conf."
                      progress={pct(kpis.expedidos, kpis.pedidos)}
                      gold
                    />
                  </div>
                </div>

                {/* Bloco ITENS */}
                <div>
                  <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-3 flex items-center gap-2">
                    <Layers className="size-3.5" /> Itens
                  </h2>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard
                      icon={Tag} label="Total de itens (Qt. Ítem)"
                      value={kpis.unidades.toLocaleString("pt-BR")}
                      sub={`${kpis.linhas.toLocaleString("pt-BR")} linhas WKU`}
                    />
                    <KpiCard
                      icon={Boxes} label="SKUs distintos (Cód. Merc.)"
                      value={kpis.skus.toLocaleString("pt-BR")}
                      sub="produtos únicos no dia"
                    />
                    <KpiCard
                      icon={PackageCheck} label="Caixas fechadas — APICE/BEAUTY"
                      value={kpis.caixasFechadas.toLocaleString("pt-BR")}
                      sub="Qt.Ítem ÷ Fator (inteiro)"
                      gold
                    />
                    <KpiCard
                      icon={Package} label="Unidades fracionadas — APICE/BEAUTY"
                      value={kpis.unidFracionadas.toLocaleString("pt-BR")}
                      sub="resto da divisão (quebra)"
                      gold
                    />
                  </div>
                </div>

                {/* Caixas vs Fração: % de pedidos */}
                {kpis.pedAB_total > 0 && (
                  <Card className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold">Caixas vs Fração — APICE / BEAUTY</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          % de pedidos com somente caixa fechada × pedidos com fração ({kpis.pedAB_total} pedidos A/B)
                        </p>
                      </div>
                    </div>
                    <div className="grid lg:grid-cols-2 gap-6 items-center">
                      <div className="space-y-4">
                        {[
                          {
                            label: "Caixas fechadas (sem fração)",
                            v: kpis.pedAB_caixaFechada,
                            color: C.primary,
                          },
                          {
                            label: "Pedidos com fração",
                            v: kpis.pedAB_fracionado,
                            color: C.gold,
                          },
                        ].map((s) => {
                          const p = pct(s.v, kpis.pedAB_total);
                          return (
                            <div key={s.label}>
                              <div className="flex items-center justify-between text-sm mb-1.5">
                                <span className="font-medium">{s.label}</span>
                                <span className="text-muted-foreground tabular-nums">
                                  {s.v} ({p}%)
                                </span>
                              </div>
                              <div className="h-3 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full transition-all rounded-full"
                                  style={{ width: `${p}%`, background: s.color }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={fracVsCaixa}
                            dataKey="value"
                            nameKey="name"
                            cx="50%" cy="50%"
                            innerRadius={55} outerRadius={90}
                            paddingAngle={3}
                          >
                            {fracVsCaixa.map((_, i) => <Cell key={i} fill={PIE[i]} />)}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background: "var(--card)",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                            }}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                )}

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

                {/* Charts */}
                <div className="grid lg:grid-cols-2 gap-6">
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

                  <Card className="p-6">
                    <h3 className="font-semibold mb-4">Top clientes (pedidos)</h3>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={topClientes} layout="vertical" margin={{ left: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} />
                        <YAxis
                          type="category" dataKey="cliente"
                          stroke="var(--muted-foreground)" fontSize={11}
                          width={140}
                          tickFormatter={(v: string) => (v.length > 20 ? v.slice(0, 18) + "…" : v)}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "var(--card)",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                          }}
                        />
                        <Bar dataKey="pedidos" fill={C.primary} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </div>

                {/* Top SKUs */}
                <Card className="p-6">
                  <h3 className="font-semibold mb-4">Top 15 SKUs por quantidade de itens</h3>
                  <ResponsiveContainer width="100%" height={420}>
                    <BarChart data={topSkus} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} />
                      <YAxis
                        type="category" dataKey="sku"
                        stroke="var(--muted-foreground)" fontSize={11}
                        width={100}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                        }}
                        formatter={(v: number, _n, p) => [v, (p.payload as { nome: string }).nome]}
                      />
                      <Bar dataKey="qt" fill={C.primary} radius={[0, 4, 4, 0]} name="Itens" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                {/* Tabela */}
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
                          <TableHead className="text-right">Linhas</TableHead>
                          <TableHead className="text-right">Sep 100%</TableHead>
                          <TableHead className="text-right">Cko 100%</TableHead>
                          <TableHead className="text-right">Caixas</TableHead>
                          <TableHead className="text-right">Frac.</TableHead>
                          <TableHead>Sit. Fase</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pedidosTable.map((p) => (
                          <TableRow key={p.pedido}>
                            <TableCell className="font-mono text-xs">{p.pedido}</TableCell>
                            <TableCell className="text-sm max-w-[260px] truncate">{p.cliente}</TableCell>
                            <TableCell className="text-right tabular-nums">{p.linhas}</TableCell>
                            <TableCell className="text-right tabular-nums">{p.sep}</TableCell>
                            <TableCell className="text-right tabular-nums">{p.cko}</TableCell>
                            <TableCell className="text-right tabular-nums">{p.caixas || "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">{p.und || "—"}</TableCell>
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
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
