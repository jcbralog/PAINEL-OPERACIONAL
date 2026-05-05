import { supabase } from "@/integrations/supabase/client";

export type WkuRow = {
  cliente: string | null;
  pedido: string | null;
  dt_conf_sep: string | null;
  sku: string | null;
  nome: string | null;
  qt_item: number;
  pct_sep: number;
  pct_cko: number;
  fator_caixa: number;
  caixas: number;
  fracionado: number;
};
export type WduRow = { pedido: string | null; sit_fase: string | null; cliente: string | null };

const PAGE = 1000;

async function fetchWku(uploadId: string): Promise<WkuRow[]> {
  const out: WkuRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("wku_rows")
      .select("cliente,pedido,dt_conf_sep,sku,nome,qt_item,pct_sep,pct_cko,fator_caixa,caixas,fracionado")
      .eq("upload_id", uploadId)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    for (const r of data) {
      out.push({
        cliente: r.cliente, pedido: r.pedido, dt_conf_sep: r.dt_conf_sep,
        sku: r.sku, nome: r.nome,
        qt_item: Number(r.qt_item ?? 0),
        pct_sep: Number(r.pct_sep ?? 0),
        pct_cko: Number(r.pct_cko ?? 0),
        fator_caixa: Number(r.fator_caixa ?? 1),
        caixas: Number(r.caixas ?? 0),
        fracionado: Number(r.fracionado ?? 0),
      });
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

async function fetchWdu(uploadId: string): Promise<WduRow[]> {
  const out: WduRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("wdu_rows").select("pedido,sit_fase,cliente").eq("upload_id", uploadId)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    for (const r of data) out.push({ pedido: r.pedido, sit_fase: r.sit_fase, cliente: r.cliente });
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

export async function loadUpload(uploadId: string) {
  const [wku, wdu] = await Promise.all([fetchWku(uploadId), fetchWdu(uploadId)]);
  return { wku, wdu };
}
