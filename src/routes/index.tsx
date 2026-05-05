import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BarChart3, Boxes, FileSpreadsheet, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Painel Operacional — WKU · WMG · WDU" },
      { name: "description", content: "Consolide separação, checkout e expedição em um único dashboard." },
    ],
  }),
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <BarChart3 className="size-5 text-primary" />
            Painel Operacional
          </div>
          <Button asChild>
            <Link to="/auth">Entrar</Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="max-w-6xl mx-auto px-6 py-24">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight max-w-3xl">
            Toda sua operação em <span className="text-primary">um único painel</span>.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
            Faça upload das planilhas <strong>WKU</strong>, <strong>WMG</strong> e <strong>WDU</strong> e
            visualize separação, checkout, caixas movimentadas e pedidos expedidos com cruzamentos
            automáticos por SKU e nº de pedido.
          </p>
          <div className="mt-10 flex gap-3">
            <Button size="lg" asChild>
              <Link to="/auth">Começar agora</Link>
            </Button>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 pb-24 grid md:grid-cols-3 gap-6">
          {[
            { icon: FileSpreadsheet, t: "3 planilhas, 1 visão", d: "WKU, WMG e WDU consolidadas em segundos." },
            { icon: Boxes, t: "Caixas vs fracionado", d: "Cálculo automático com fator-caixa da WMG por SKU." },
            { icon: TrendingUp, t: "Funil completo", d: "Separado → Checkout → Expedido (Emb. Conf.)." },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-lg border border-border p-6 bg-card">
              <Icon className="size-6 text-primary" />
              <h3 className="mt-4 font-semibold">{t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
