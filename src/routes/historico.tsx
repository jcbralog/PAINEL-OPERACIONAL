import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/historico")({ component: HistoricoPage });

type Row = {
  id: string;
  uploaded_at: string;
  reference_date: string | null;
  wku_count: number;
  wmg_count: number;
  wxd_count: number;
};

function HistoricoPage() {
  const [rows, setRows] = useState<Row[]>([]);

  const load = () => {
    supabase
      .from("uploads")
      .select("id,uploaded_at,reference_date,wku_count,wmg_count,wxd_count")
      .order("uploaded_at", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as Row[]));
  };
  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    if (!confirm("Excluir este upload e todos os dados?")) return;
    const { error } = await supabase.from("uploads").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Removido"); load(); }
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground w-full md:w-auto text-center md:text-left">← Dashboard</Link>
          <Button asChild className="w-full md:w-auto"><Link to="/upload"><Upload className="size-4" />Novo upload</Link></Button>
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
                <TableHead className="text-right">WXD</TableHead>
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
                  <TableCell className="text-right tabular-nums">{r.wxd_count}</TableCell>
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
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    Sem uploads ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </main>
    </div>
  );
}
