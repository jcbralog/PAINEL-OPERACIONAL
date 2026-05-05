import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/historico")({ component: HistoricoPage });

type Row = { id: string; uploaded_at: string; reference_date: string | null; wku_count: number; wmg_count: number; wdu_count: number };

function HistoricoPage() {
  const nav = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => { if (!authLoading && !user) nav({ to: "/auth" }); }, [authLoading, user, nav]);

  const load = () => {
    supabase.from("uploads").select("*").order("uploaded_at", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as Row[]));
  };
  useEffect(() => { if (user) load(); }, [user]);

  const remove = async (id: string) => {
    if (!confirm("Excluir este upload e todos os dados?")) return;
    const { error } = await supabase.from("uploads").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Removido"); load(); }
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">← Dashboard</Link>
          <Button asChild><Link to="/upload"><Upload className="size-4" />Novo upload</Link></Button>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-6">Histórico de uploads</h1>
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data ref.</TableHead>
                <TableHead>Enviado em</TableHead>
                <TableHead className="text-right">WKU</TableHead>
                <TableHead className="text-right">WMG</TableHead>
                <TableHead className="text-right">WDU</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.reference_date ?? "—"}</TableCell>
                  <TableCell>{new Date(r.uploaded_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.wku_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.wmg_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.wdu_count}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/dashboard" search={{ id: r.id }}>Abrir</Link>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">Sem uploads ainda.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </main>
    </div>
  );
}
