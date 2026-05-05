import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { buildFatorMap, computeWku, parseWdu, parseWku, parseWmg } from "@/lib/operation";

export const Route = createFileRoute("/upload")({ component: UploadPage });

type Slot = "wku" | "wmg" | "wdu";
const labels: Record<Slot, string> = {
  wku: "WKU — Relatório da Operação",
  wmg: "WMG — Cadastro do Cliente",
  wdu: "WDU — Documentos de Saída",
};

function Drop({ slot, file, onFile }: { slot: Slot; file: File | null; onFile: (f: File) => void }) {
  const onDrop = useCallback((accepted: File[]) => accepted[0] && onFile(accepted[0]), [onFile]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
    multiple: false,
  });
  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-6 cursor-pointer transition ${
        file ? "border-primary/50 bg-primary/5" : isDragActive ? "border-primary" : "border-border hover:border-primary/40"
      }`}
    >
      <input {...getInputProps()} />
      <div className="flex items-center gap-3">
        {file ? <CheckCircle2 className="size-5 text-primary" /> : <FileUp className="size-5 text-muted-foreground" />}
        <div className="flex-1">
          <div className="font-medium text-sm">{labels[slot]}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {file ? file.name : "Arraste o .xlsx ou clique para selecionar"}
          </div>
        </div>
      </div>
    </div>
  );
}

async function chunkInsert<T>(table: "wku_rows" | "wmg_rows" | "wdu_rows", rows: T[], onProgress: (p: number) => void) {
  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).insert(slice as never);
    if (error) throw error;
    onProgress(Math.min(100, Math.round(((i + slice.length) / rows.length) * 100)));
  }
}

function UploadPage() {
  const nav = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [files, setFiles] = useState<Record<Slot, File | null>>({ wku: null, wmg: null, wdu: null });
  const [refDate, setRefDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<string>("");

  useEffect(() => {
    if (!authLoading && !user) nav({ to: "/auth" });
  }, [authLoading, user, nav]);

  const allReady = files.wku && files.wmg && files.wdu;

  const onSubmit = async () => {
    if (!user || !allReady) return;
    setBusy(true);
    setProgress(2);
    try {
      setStep("Lendo planilhas...");
      const [wkuBuf, wmgBuf, wduBuf] = await Promise.all([
        files.wku!.arrayBuffer(),
        files.wmg!.arrayBuffer(),
        files.wdu!.arrayBuffer(),
      ]);
      const wku = parseWku(wkuBuf);
      const wmg = parseWmg(wmgBuf);
      const wdu = parseWdu(wduBuf);
      setStep("Cruzando WMG (fator-caixa)...");
      const fmap = buildFatorMap(wmg);
      const wkuC = computeWku(wku, fmap);

      setStep("Criando registro do upload...");
      const { data: up, error } = await supabase
        .from("uploads")
        .insert({
          user_id: user.id,
          reference_date: refDate || null,
          wku_count: wkuC.length,
          wmg_count: wmg.length,
          wdu_count: wdu.length,
        })
        .select("id")
        .single();
      if (error) throw error;
      const uploadId = up.id as string;

      setStep("Salvando WMG...");
      await chunkInsert("wmg_rows", wmg.map((r) => ({ ...r, upload_id: uploadId })), (p) => setProgress(5 + p * 0.15));
      setStep("Salvando WDU...");
      await chunkInsert("wdu_rows", wdu.map((r) => ({ ...r, upload_id: uploadId })), (p) => setProgress(20 + p * 0.2));
      setStep("Salvando WKU...");
      await chunkInsert("wku_rows", wkuC.map((r) => ({ ...r, upload_id: uploadId })), (p) => setProgress(40 + p * 0.6));

      toast.success("Upload concluído!");
      nav({ to: "/dashboard", search: { id: uploadId } });
    } catch (e: unknown) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">← Dashboard</Link>
          <span className="text-sm text-muted-foreground">{user?.email}</span>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold">Novo upload</h1>
        <p className="text-muted-foreground mt-2">Envie as três planilhas da operação. O cruzamento WMG×WKU é feito automaticamente.</p>

        <Card className="mt-8 p-6 space-y-4">
          {(["wku", "wmg", "wdu"] as Slot[]).map((s) => (
            <Drop key={s} slot={s} file={files[s]} onFile={(f) => setFiles((p) => ({ ...p, [s]: f }))} />
          ))}

          <div className="grid md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <Label>Data de referência</Label>
              <Input type="date" value={refDate} onChange={(e) => setRefDate(e.target.value)} />
            </div>
          </div>

          {busy && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> {step}
              </div>
              <Progress value={progress} />
            </div>
          )}

          <Button className="w-full" size="lg" disabled={!allReady || busy} onClick={onSubmit}>
            {busy ? "Processando..." : "Processar e abrir dashboard"}
          </Button>
        </Card>
      </main>
    </div>
  );
}
