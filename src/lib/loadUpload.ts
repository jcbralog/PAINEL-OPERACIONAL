import { supabase } from "@/integrations/supabase/client";

export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

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

export async function loadUpload(uploadId: string) {
  const wku = await fetchAll<WkuRow>((from, to) =>
    supabase.from("wku_rows").select("cliente,pedido,dt_conf_sep,sku,nome,qt_item,pct_sep,pct_cko,fator_caixa,caixas,fracionado").eq("upload_id", uploadId).range(from, to)
  );
  const wdu = await fetchAll<WduRow>((from, to) =>
    supabase.from("wdu_rows").select("pedido,sit_fase,cliente").eq("upload_id", uploadId).range(from, to)
  );
  return { wku, wdu };
}
