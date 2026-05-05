-- Tabelas para Dashboard de Operação
CREATE TABLE public.uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  reference_date date,
  notes text,
  wku_count int NOT NULL DEFAULT 0,
  wmg_count int NOT NULL DEFAULT 0,
  wdu_count int NOT NULL DEFAULT 0
);

CREATE TABLE public.wku_rows (
  id bigserial PRIMARY KEY,
  upload_id uuid NOT NULL REFERENCES public.uploads(id) ON DELETE CASCADE,
  cliente text,
  pedido text,
  dt_conf_sep timestamptz,
  sku text,
  nome text,
  qt_item numeric,
  pct_sep numeric,
  pct_cko numeric,
  fator_caixa int NOT NULL DEFAULT 1,
  caixas int NOT NULL DEFAULT 0,
  fracionado numeric NOT NULL DEFAULT 0
);
CREATE INDEX wku_upload_idx ON public.wku_rows(upload_id);
CREATE INDEX wku_pedido_idx ON public.wku_rows(upload_id, pedido);
CREATE INDEX wku_sku_idx ON public.wku_rows(upload_id, sku);

CREATE TABLE public.wmg_rows (
  id bigserial PRIMARY KEY,
  upload_id uuid NOT NULL REFERENCES public.uploads(id) ON DELETE CASCADE,
  sku text,
  fator numeric,
  nome text
);
CREATE INDEX wmg_upload_idx ON public.wmg_rows(upload_id);
CREATE INDEX wmg_sku_idx ON public.wmg_rows(upload_id, sku);

CREATE TABLE public.wdu_rows (
  id bigserial PRIMARY KEY,
  upload_id uuid NOT NULL REFERENCES public.uploads(id) ON DELETE CASCADE,
  cliente text,
  pedido text,
  sit_fase text
);
CREATE INDEX wdu_upload_idx ON public.wdu_rows(upload_id);
CREATE INDEX wdu_pedido_idx ON public.wdu_rows(upload_id, pedido);

ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wku_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wmg_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wdu_rows ENABLE ROW LEVEL SECURITY;

-- Policies uploads (dono = user_id)
CREATE POLICY "uploads_select_own" ON public.uploads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "uploads_insert_own" ON public.uploads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "uploads_update_own" ON public.uploads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "uploads_delete_own" ON public.uploads FOR DELETE USING (auth.uid() = user_id);

-- Helper: linha pertence ao usuário se o upload é dele
CREATE POLICY "wku_select_own" ON public.wku_rows FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.uploads u WHERE u.id = upload_id AND u.user_id = auth.uid()));
CREATE POLICY "wku_insert_own" ON public.wku_rows FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.uploads u WHERE u.id = upload_id AND u.user_id = auth.uid()));
CREATE POLICY "wku_delete_own" ON public.wku_rows FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.uploads u WHERE u.id = upload_id AND u.user_id = auth.uid()));

CREATE POLICY "wmg_select_own" ON public.wmg_rows FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.uploads u WHERE u.id = upload_id AND u.user_id = auth.uid()));
CREATE POLICY "wmg_insert_own" ON public.wmg_rows FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.uploads u WHERE u.id = upload_id AND u.user_id = auth.uid()));
CREATE POLICY "wmg_delete_own" ON public.wmg_rows FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.uploads u WHERE u.id = upload_id AND u.user_id = auth.uid()));

CREATE POLICY "wdu_select_own" ON public.wdu_rows FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.uploads u WHERE u.id = upload_id AND u.user_id = auth.uid()));
CREATE POLICY "wdu_insert_own" ON public.wdu_rows FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.uploads u WHERE u.id = upload_id AND u.user_id = auth.uid()));
CREATE POLICY "wdu_delete_own" ON public.wdu_rows FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.uploads u WHERE u.id = upload_id AND u.user_id = auth.uid()));