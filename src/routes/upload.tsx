import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { 
  CheckCircle2, FileUp, Loader2, Plus, X, 
  Upload as UploadIcon, Truck, Layers 
} from "lucide-react";
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

/** Retorna a data local no formato YYYY-MM-DD sem depender do fuso UTC */
function localDateStr(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Formata data YYYY-MM-DD como "DIA-DA-SEMANA: DD/MM/AAAA [· HH:MM]" igual ao dashboard */
function previewTitle(dateStr: string, isToday: boolean): string {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.toLocaleDateString("pt-BR", { weekday: "long" }).toUpperCase();
  const date = d.toLocaleDateString("pt-BR");
  if (isToday) {
    const now = new Date();
    const time = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return `${day}: ${date} · ${time}`;
  }
  return `${day}: ${date}`;
}

function UploadPage() {
  const nav = useNavigate();
  const [wku, setWku] = useState<File | null>(null);
  const [wmgs, setWmgs] = useState<(File | null)[]>([null]);
  const [wxd, setWxd] = useState<File | null>(null);

  // Modo de referência temporal
  type RefMode = "today" | "yesterday" | "other";
  const [refMode, setRefMode] = useState<RefMode>("today");
  const [refDate, setRefDate] = useState<string>(localDateStr(0));

  const handleRefMode = (mode: RefMode) => {
    setRefMode(mode);
    if (mode === "today") setRefDate(localDateStr(0));
    if (mode === "yesterday") setRefDate(localDateStr(1));
    // "other": mantém o refDate atual para o usuário ajustar
  };

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<string>("");

  const [uploads, setUploads] = useState<{id: string, reference_date: string | null, uploaded_at: string}[]>([]);
  const [selectedUploadId, setSelectedUploadId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("uploads").select("id, reference_date, created_at").order("created_at", {ascending: false}).limit(10).then(({data, error}) => {
      if (error) console.error("Erro ao buscar uploads:", error);
      if (data) setUploads(data.map(u => ({ ...u, uploaded_at: u.created_at || "" })));
    });
  }, []);

  const readyFull = wku && wxd && wmgs.some((f) => f);
  const readyWxdOnly = wxd && selectedUploadId;

  const addWmgSlot = () => setWmgs((p) => [...p, null]);
  const removeWmgSlot = (idx: number) =>
    setWmgs((p) => (p.length === 1 ? [null] : p.filter((_, i) => i !== idx)));
  const setWmgAt = (idx: number, f: File | null) =>
    setWmgs((p) => p.map((x, i) => (i === idx ? f : x)));

  const onSubmitFull = async () => {
    if (!readyFull) return;
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
        wmgFlat.map((r) => {
          const { sep: _s, cko: _c, cv: _v, ...rest } = r;
          return { ...rest, upload_id: uploadId };
        }),
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
      console.error("ERRO NO UPLOAD:", e);
      if (e && typeof e === 'object' && 'message' in e) {
        toast.error(`Falha no upload: ${e.message}`);
      } else {
        toast.error("Falha no upload. Verifique o console para mais detalhes.");
      }
    } finally {
      setBusy(false);
    }
  };

  const onSubmitWxdOnly = async () => {
    if (!readyWxdOnly) return;
    setBusy(true);
    setProgress(5);
    try {
      setStep("Lendo planilha WXD...");
      const buf = await wxd!.arrayBuffer();
      const rows = parseWxd(buf);

      setStep("Limpando expedição anterior...");
      const { error: delErr } = await supabase
        .from("wxd_rows")
        .delete()
        .eq("upload_id", selectedUploadId);
      if (delErr) throw delErr;

      setStep("Salvando nova expedição...");
      await chunkInsert(
        "wxd_rows",
        rows.map((r) => ({ ...r, upload_id: selectedUploadId })),
        (p) => setProgress(10 + p * 0.8),
      );

      setStep("Atualizando contador...");
      await supabase
        .from("uploads")
        .update({ wxd_count: rows.length })
        .eq("id", selectedUploadId);

      toast.success("Expedição atualizada!");
      nav({ to: "/dashboard", search: { id: selectedUploadId } });
    } catch (e: unknown) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-2">
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            ← Dashboard
          </Link>
          <span className="text-sm text-muted-foreground text-center md:text-left">Bralog · Painel Operacional</span>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold">Importação de Dados</h1>
        <p className="text-muted-foreground mt-2">
          Selecione o tipo de importação que deseja realizar.
        </p>

        <Tabs defaultValue="full" className="mt-8 space-y-6">
          <TabsList className="flex flex-col h-auto md:grid w-full md:grid-cols-2 gap-1 p-1">
            <TabsTrigger value="full" className="gap-2 w-full whitespace-normal h-auto py-2">
              <Layers className="size-4 shrink-0" /> Upload Completo (WKU + WMG + WXD)
            </TabsTrigger>
            <TabsTrigger value="wxd" className="gap-2 w-full whitespace-normal h-auto py-2">
              <Truck className="size-4 shrink-0" /> Somente Expedição (WXD)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="full" className="space-y-5">
            <Card className="p-6 space-y-5">
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

              {/* ─── Referência temporal ─── */}
              <div className="space-y-3 pt-2">
                <Label>Quando é essa operação?</Label>

                {/* Botões de seleção rápida */}
                <div className="flex gap-2 flex-wrap">
                  {([
                    { mode: "today"     as const, label: "📅 Hoje" },
                    { mode: "yesterday" as const, label: "🌙 Ontem" },
                    { mode: "other"     as const, label: "📆 Outro dia" },
                  ]).map(({ mode, label }) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleRefMode(mode)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                        refMode === mode
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-border bg-muted/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Picker só aparece em "Outro dia" */}
                {refMode === "other" && (
                  <Input
                    type="date"
                    value={refDate}
                    onChange={(e) => setRefDate(e.target.value)}
                    className="max-w-xs"
                  />
                )}

                {/* Preview de como vai aparecer no painel */}
                {refDate && (
                  <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                    <span className="text-primary mt-0.5">🔖</span>
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">Como vai aparecer no painel:</p>
                      <p className="font-bold text-sm tracking-wider" style={{ color: "var(--primary)" }}>
                        {previewTitle(refDate, refMode === "today")}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {refMode === "today"
                          ? "Operação em andamento — hora atualizada a cada import"
                          : "Operação encerrada — hora não exibida (resumo do dia)"}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {busy && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> {step}
                  </div>
                  <Progress value={progress} />
                </div>
              )}

              <Button className="w-full" size="lg" disabled={!readyFull || busy} onClick={onSubmitFull}>
                {busy ? "Processando..." : "Processar e abrir dashboard"}
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="wxd" className="space-y-5">
            <Card className="p-6 space-y-5">
              <div className="space-y-2">
                <Label>Vincular ao upload:</Label>
                <Select value={selectedUploadId ?? ""} onValueChange={setSelectedUploadId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um upload existente" />
                  </SelectTrigger>
                  <SelectContent>
                    {uploads.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {new Date(u.uploaded_at).toLocaleDateString("pt-BR")} -{" "}
                        {new Date(u.uploaded_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DropOne
                label="WXD — Planilha de Expedição"
                hint="Selecione apenas a planilha WXD para atualizar os dados de expedição"
                file={wxd}
                onFile={setWxd}
                onClear={() => setWxd(null)}
              />

              {busy && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> {step}
                  </div>
                  <Progress value={progress} />
                </div>
              )}

              <Button className="w-full" size="lg" disabled={!readyWxdOnly || busy} onClick={onSubmitWxdOnly}>
                {busy ? "Atualizando..." : "Atualizar Expedição"}
              </Button>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default UploadPage;
