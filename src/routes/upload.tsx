import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { CheckCircle2, FileUp, Loader2, Plus, X } from "lucide-react";
import {
  buildFatorMap,
  computeWku,
  parseWku,
  parseWmg,
  parseWxd,
  type WmgRaw,
} from "@/lib/operation";

export const Route = createFileRoute("/upload")({ component: UploadPage });

function DropOne({
  label,
  hint,
  file,
  onFile,
  onClear,
}: {
  label: string;
  hint: string;
  file: File | null;
  onFile: (f: File) => void;
  onClear?: () => void;
}) {
  const onDrop = useCallback((accepted: File[]) => accepted[0] && onFile(accepted[0]), [onFile]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
    multiple: false,
  });
  return (
    <div
      {...getRootProps()}
      className={`relative border-2 border-dashed rounded-lg p-5 cursor-pointer transition ${
        file
          ? "border-primary/60 bg-primary/5"
          : isDragActive
          ? "border-primary"
          : "border-border hover:border-primary/40"
      }`}
    >
      <input {...getInputProps()} />
      <div className="flex items-center gap-3">
        {file ? (
          <CheckCircle2 className="size-5 text-primary shrink-0" />
        ) : (
          <FileUp className="size-5 text-muted-foreground shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">{label}</div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {file ? file.name : hint}
          </div>
        </div>
        {file && onClear && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

async function chunkInsert<T>(
  table: "wku_rows" | "wmg_rows" | "wxd_rows",
  rows: T[],
  onProgress: (p: number) => void,
) {
  if (rows.length === 0) { onProgress(100); return; }
  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from(table).insert(slice as any);
    if (error) throw error;
    onProgress(Math.min(100, Math.round(((i + slice.length) / rows.length) * 100)));
  }
}

function UploadPage() {
  const nav = useNavigate();
  const [wku, setWku] = useState<File | null>(null);
  const [wmgs, setWmgs] = useState<(File | null)[]>([null]);
  const [wxd, setWxd] = useState<File | null>(null);
  const [refDate, setRefDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<string>("");

  const ready = wku && wxd && wmgs.some((f) => f);

  const addWmgSlot = () => setWmgs((p) => [...p, null]);
  const removeWmgSlot = (idx: number) =>
    setWmgs((p) => (p.length === 1 ? [null] : p.filter((_, i) => i !== idx)));
  const setWmgAt = (idx: number, f: File | null) =>
    setWmgs((p) => p.map((x, i) => (i === idx ? f : x)));

  const onSubmit = async () => {
    if (!ready) return;
    setBusy(true);
    setProgress(2);
    try {
      setStep("Lendo planilhas...");
      const wmgFiles = wmgs.filter((f): f is File => !!f);
      const [wkuBuf, wxdBuf, ...wmgBufs] = await Promise.all([
        wku!.arrayBuffer(),
        wxd!.arrayBuffer(),
        ...wmgFiles.map((f) => f.arrayBuffer()),
      ]);
      const wkuRows = parseWku(wkuBuf);
      const wxdRows = parseWxd(wxdBuf);
      const wmgArrays: WmgRaw[][] = wmgBufs.map((b) => parseWmg(b));
      const wmgFlat: WmgRaw[] = wmgArrays.flat();

      setStep("Cruzando WMG (fator-caixa) — APICE/BEAUTY...");
      const fmap = buildFatorMap(wmgArrays);
      const wkuC = computeWku(wkuRows, fmap);

      setStep("Criando registro do upload...");
      const { data: up, error } = await supabase
        .from("uploads")
        .insert({
          reference_date: refDate || null,
          wku_count: wkuC.length,
          wmg_count: wmgFlat.length,
          wxd_count: wxdRows.length,
        })
        .select("id")
        .single();
      if (error) throw error;
      const uploadId = up.id as string;

      setStep("Salvando WMG...");
      await chunkInsert(
        "wmg_rows",
        wmgFlat.map((r) => ({ ...r, upload_id: uploadId })),
        (p) => setProgress(5 + p * 0.15),
      );
      setStep("Salvando WXD (expedidos)...");
      await chunkInsert(
        "wxd_rows",
        wxdRows.map((r) => ({ ...r, upload_id: uploadId })),
        (p) => setProgress(20 + p * 0.2),
      );
      setStep("Salvando WKU...");
      await chunkInsert(
        "wku_rows",
        wkuC.map((r) => {
          const { is_apice_beauty: _omit, ...rest } = r;
          void _omit;
          return { ...rest, upload_id: uploadId };
        }),
        (p) => setProgress(40 + p * 0.6),
      );

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
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            ← Dashboard
          </Link>
          <span className="text-sm text-muted-foreground">Bralog · Painel Operacional</span>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold">Novo upload</h1>
        <p className="text-muted-foreground mt-2">
          Envie a WKU, as WMGs (Apice e/ou Beauty) e a WXD. O cruzamento é feito automaticamente.
        </p>

        <Card className="mt-8 p-6 space-y-5">
          <DropOne
            label="WKU — Relatório de pedidos"
            hint="Arraste o .xlsx ou clique para selecionar"
            file={wku}
            onFile={setWku}
            onClear={() => setWku(null)}
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">WMG — Cadastros (APICE / BEAUTY)</Label>
              <Button type="button" size="sm" variant="outline" onClick={addWmgSlot}>
                <Plus className="size-4" /> Adicionar WMG
              </Button>
            </div>
            {wmgs.map((f, i) => (
              <DropOne
                key={i}
                label={`WMG #${i + 1}`}
                hint="Cadastro do cliente (APICE ou BEAUTY)"
                file={f}
                onFile={(file) => setWmgAt(i, file)}
                onClear={() => removeWmgSlot(i)}
              />
            ))}
          </div>

          <DropOne
            label="WXD — Pedidos expedidos"
            hint="Planilha com Sit. Fase = Emb. Conf."
            file={wxd}
            onFile={setWxd}
            onClear={() => setWxd(null)}
          />

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

          <Button className="w-full" size="lg" disabled={!ready || busy} onClick={onSubmit}>
            {busy ? "Processando..." : "Processar e abrir dashboard"}
          </Button>
        </Card>
      </main>
    </div>
  );
}
