import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { loadUpload, type WduRow, type WkuRow } from "@/lib/loadUpload";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { BarChart3, Boxes, CheckCheck, History, LogOut, Package, PackageCheck, Truck, Upload } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  validateSearch: z.object({ id: z.string().optional() }),
});

type UploadRow = { id: string; uploaded_at: string; reference_date: string | null; wku_count: number };

const COLORS = ["hsl(217 91% 60%)", "hsl(142 71% 45%)", "hsl(38 92% 50%)", "hsl(0 84% 60%)", "hsl(280 83% 58%)"];

function KpiCard({
  icon: Icon, label, value, sub, progress, accent,
}: { icon: typeof BarChart3; label: string; value: string; sub?: string; progress?: number; accent?: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-3xl font-bold mt-1.5">{value}</div>
          {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
        </div>
        <div className={`p-2 rounded-md ${accent ?? "bg-primary/10 text-primary"}`}>
          <Icon className="size-5" />
        </div>
      </div>
      {progress !== undefined && <Progress value={progress} className="mt-4 h-1.5" />}
    </Card>
  );
}

function DashboardPage() {
  const nav = useNavigate();
  const { id } = Route.useSearch();
  const { user, loading: authLoading } = useAuth();

  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [selected, setSelected] = useState<string | null>(id ?? null);
  const [loading, setLoading] = useState(false);
  const [wku, setWku] = useState<WkuRow[]>([]);
  const [wdu, setWdu] = useState<WduRow[]>([]);

  // filtros
  const [search, setSearch] = useState("");
  const [clienteFilter, setClienteFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all"); // sep / cko / exp / pendente

  useEffect(() => {
    if (!authLoading && !user) nav({ to: "/auth" });
  }, [authLoading, user, nav]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("uploads")
      .select("id,uploaded_at,reference_date,wku_count")
      .order("uploaded_at", { ascending: false })
      .then(({ data }) => {
        const rows = (data ?? []) as UploadRow[];
        setUploads(rows);
        if (!selected && rows[0]) setSelected(rows[0].id);
      });
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    loadUpload(selected)
      .then(({ wku, wdu }) => { setWku(wku); setWdu(wdu); })
      .finally(() => setLoading(false));
  }, [selected]);

  // mapa pedido → sit_fase (último visto)
  const faseMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of wdu) if (r.pedido) m.set(r.pedido, r.sit_fase ?? "");
    return m;
  }, [wdu]);

  const clientes = useMemo(() => Array.from(new Set(wku.map((r) => r.cliente).filter(Boolean) as string[])).sort(), [wku]);

  // aplica filtros (linhas WKU)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return wku.filter((r) => {
      if (clienteFilter !== "all" && r.cliente !== clienteFilter) return false;
      if (q && !(`${r.pedido ?? ""} ${r.sku ?? ""} ${r.nome ?? ""}`.toLowerCase().includes(q))) return false;
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

  // KPIs (sobre filtered)
  const kpis = useMemo(() => {
    const linhas = filtered.length;
    const linhasSep = filtered.filter((r) => r.pct_sep === 100).length;
    const linhasCko = filtered.filter((r) => r.pct_cko === 100).length;
    const pedidosSet = new Set(filtered.map((r) => r.pedido).filter(Boolean));
    const pedidosSepSet = new Set(filtered.filter((r) => r.pct_sep === 100).map((r) => r.pedido).filter(Boolean));
    const pedidosCkoSet = new Set(filtered.filter((r) => r.pct_cko === 100).map((r) => r.pedido).filter(Boolean));
    const pedidos = pedidosSet.size;
    const pedidosSep = pedidosSepSet.size;
    const pedidosCko = pedidosCkoSet.size;
    const skus = new Set(filtered.map((r) => r.sku).filter(Boolean)).size;
    const caixas = filtered.reduce((a, r) => a + (r.caixas || 0), 0);
    const fracionado = filtered.reduce((a, r) => a + (r.fracionado || 0), 0);
    const unidades = filtered.reduce((a, r) => a + (r.qt_item || 0), 0);
    const expedidos = Array.from(pedidosSet).filter((p) => p && faseMap.get(p) === "Emb. Conf.").length;
    return { linhas, linhasSep, linhasCko, pedidos, pedidosSep, pedidosCko, skus, caixas, fracionado, unidades, expedidos };
  }, [filtered, faseMap]);

  // séries
  const porHora = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) {
      if (!r.dt_conf_sep || r.pct_sep !== 100) continue;
      const h = new Date(r.dt_conf_sep).toISOString().slice(0, 13) + ":00";
      m.set(h, (m.get(h) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({
      hora: k.slice(11, 16),
      separado: v,
    }));
  }, [filtered]);

  const topSkus = useMemo(() => {
    const m = new Map<string, { caixas: number; und: number; nome: string }>();
    for (const r of filtered) {
      if (!r.sku) continue;
      const cur = m.get(r.sku) ?? { caixas: 0, und: 0, nome: r.nome ?? "" };
      cur.caixas += r.caixas || 0;
      cur.und += r.fracionado || 0;
      m.set(r.sku, cur);
    }
    return Array.from(m.entries())
      .map(([sku, v]) => ({ sku, ...v, total: v.caixas * 1000 + v.und }))
      .sort((a, b) => b.caixas - a.caixas || b.und - a.und)
      .slice(0, 15)
      .map((x) => ({ ...x, label: `${x.sku}` }));
  }, [filtered]);

  const fasePie = useMemo(() => {
    const pedidoSet = new Set(filtered.map((r) => r.pedido).filter(Boolean) as string[]);
    const m = new Map<string, number>();
    for (const p of pedidoSet) {
      const f = faseMap.get(p) ?? "Sem WDU";
      m.set(f, (m.get(f) ?? 0) + 1);
    }
    return Array.from(m.entries()).map(([fase, qtd]) => ({ fase, qtd }));
  }, [filtered, faseMap]);

  // Tabela: agrupar por pedido
  const pedidosTable = useMemo(() => {
    const map = new Map<string, { pedido: string; cliente: string; linhas: number; sep: number; cko: number; caixas: number; und: number; fase: string }>();
    for (const r of filtered) {
      const p = r.pedido ?? "—";
      const cur = map.get(p) ?? { pedido: p, cliente: r.cliente ?? "", linhas: 0, sep: 0, cko: 0, caixas: 0, und: 0, fase: faseMap.get(p) ?? "—" };
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2 font-semibold">
            <BarChart3 className="size-5 text-primary" />
            Painel Operacional
          </div>
          <div className="flex-1" />
          <Select value={selected ?? ""} onValueChange={(v) => setSelected(v)}>
            <SelectTrigger className="w-[280px]"><SelectValue placeholder="Selecionar upload" /></SelectTrigger>
            <SelectContent>
              {uploads.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {(u.reference_date ?? new Date(u.uploaded_at).toLocaleDateString("pt-BR"))} · {u.wku_count} linhas
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" asChild><Link to="/historico"><History className="size-4" />Histórico</Link></Button>
          <Button asChild><Link to="/upload"><Upload className="size-4" />Novo upload</Link></Button>
          <Button variant="ghost" size="icon" onClick={async () => { await supabase.auth.signOut(); nav({ to: "/auth" }); }}>
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
        {!selected && uploads.length === 0 && (
          <Card className="p-12 text-center">
            <h2 className="text-xl font-semibold">Nenhum upload ainda</h2>
            <p className="text-muted-foreground mt-2">Envie suas três planilhas para começar.</p>
            <Button className="mt-6" asChild><Link to="/upload">Fazer primeiro upload</Link></Button>
          </Card>
        )}

        {selected && (
          <>
            {/* Filtros */}
            <Card className="p-4 flex flex-wrap gap-3 items-center">
              <Input
                placeholder="Buscar pedido, SKU ou nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
              />
              <Select value={clienteFilter} onValueChange={setClienteFilter}>
                <SelectTrigger className="w-[220px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {clientes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Status" /></SelectTrigger>
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
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
              </div>
            ) : (
              <>
                {/* KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <KpiCard icon={Package} label="Pedidos separados" value={`${kpis.pedidosSep}/${kpis.pedidos}`}
                    sub={`${pct(kpis.pedidosSep, kpis.pedidos)}% do total`} progress={pct(kpis.pedidosSep, kpis.pedidos)} />
                  <KpiCard icon={CheckCheck} label="Em checkout 100%" value={kpis.pedidosCko.toString()}
                    sub={`${kpis.linhasCko.toLocaleString("pt-BR")} linhas`} progress={pct(kpis.pedidosCko, kpis.pedidos)}
                    accent="bg-emerald-500/10 text-emerald-500" />
                  <KpiCard icon={Truck} label="Expedidos" value={kpis.expedidos.toString()}
                    sub="Sit. Fase = Emb. Conf." progress={pct(kpis.expedidos, kpis.pedidos)}
                    accent="bg-amber-500/10 text-amber-500" />
                  <KpiCard icon={Boxes} label="SKUs distintos" value={kpis.skus.toString()}
                    sub={`${kpis.linhas.toLocaleString("pt-BR")} linhas WKU`} />
                  <KpiCard icon={PackageCheck} label="Caixas movimentadas" value={kpis.caixas.toLocaleString("pt-BR")}
                    sub="caixas fechadas (fator>1)" />
                  <KpiCard icon={Package} label="Unidades fracionadas" value={kpis.fracionado.toLocaleString("pt-BR")}
                    sub="quebra de caixa + soltos" />
                  <KpiCard icon={BarChart3} label="Total de unidades" value={kpis.unidades.toLocaleString("pt-BR")}
                    sub="Σ Qt. Ítem" />
                  <KpiCard icon={CheckCheck} label="% Separação" value={`${pct(kpis.linhasSep, kpis.linhas)}%`}
                    sub={`${kpis.linhasSep.toLocaleString("pt-BR")} de ${kpis.linhas.toLocaleString("pt-BR")} linhas`}
                    progress={pct(kpis.linhasSep, kpis.linhas)} />
                </div>

                {/* Funil */}
                <Card className="p-6">
                  <h3 className="font-semibold mb-4">Funil da operação (pedidos)</h3>
                  <div className="space-y-3">
                    {[
                      { label: "Pedidos totais", v: kpis.pedidos, color: "bg-muted" },
                      { label: "Separados (100%)", v: kpis.pedidosSep, color: "bg-primary" },
                      { label: "Em checkout (100%)", v: kpis.pedidosCko, color: "bg-emerald-500" },
                      { label: "Expedidos (Emb. Conf.)", v: kpis.expedidos, color: "bg-amber-500" },
                    ].map((s) => {
                      const p = pct(s.v, kpis.pedidos);
                      return (
                        <div key={s.label}>
                          <div className="flex items-center justify-between text-sm mb-1.5">
                            <span>{s.label}</span>
                            <span className="text-muted-foreground tabular-nums">{s.v.toLocaleString("pt-BR")} ({p}%)</span>
                          </div>
                          <div className="h-3 rounded bg-muted overflow-hidden">
                            <div className={`h-full ${s.color} transition-all`} style={{ width: `${p}%` }} />
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
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="hora" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                        <Line type="monotone" dataKey="separado" stroke={COLORS[0]} strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>

                  <Card className="p-6">
                    <h3 className="font-semibold mb-4">Distribuição por Sit. Fase (pedidos)</h3>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={fasePie} dataKey="qtd" nameKey="fase" cx="50%" cy="50%" outerRadius={90} label>
                          {fasePie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Legend />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Card>
                </div>

                {/* Top SKUs */}
                <Card className="p-6">
                  <h3 className="font-semibold mb-4">Top 15 SKUs por caixas movimentadas</h3>
                  <ResponsiveContainer width="100%" height={380}>
                    <BarChart data={topSkus} layout="vertical" margin={{ left: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis type="category" dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} width={90} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Legend />
                      <Bar dataKey="caixas" stackId="a" fill={COLORS[0]} name="Caixas" />
                      <Bar dataKey="und" stackId="a" fill={COLORS[2]} name="Fracionado" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                {/* Tabela de pedidos */}
                <Card className="p-6">
                  <h3 className="font-semibold mb-4">Pedidos (top 200 por nº de linhas)</h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pedido</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead className="text-right">Linhas</TableHead>
                          <TableHead className="text-right">Sep</TableHead>
                          <TableHead className="text-right">Cko</TableHead>
                          <TableHead className="text-right">Caixas</TableHead>
                          <TableHead className="text-right">Fracionado</TableHead>
                          <TableHead>Fase</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pedidosTable.map((p) => (
                          <TableRow key={p.pedido}>
                            <TableCell className="font-medium">{p.pedido}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">{p.cliente}</TableCell>
                            <TableCell className="text-right tabular-nums">{p.linhas}</TableCell>
                            <TableCell className="text-right tabular-nums">{p.sep}/{p.linhas}</TableCell>
                            <TableCell className="text-right tabular-nums">{p.cko}/{p.linhas}</TableCell>
                            <TableCell className="text-right tabular-nums">{p.caixas}</TableCell>
                            <TableCell className="text-right tabular-nums">{p.und}</TableCell>
                            <TableCell>
                              <Badge variant={p.fase === "Emb. Conf." ? "default" : "secondary"}>{p.fase}</Badge>
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
