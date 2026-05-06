
-- 1. Renomear wdu_rows para wxd_rows
ALTER TABLE public.wdu_rows RENAME TO wxd_rows;
ALTER TABLE public.uploads RENAME COLUMN wdu_count TO wxd_count;

-- 2. Adicionar coluna dt_embarque em wxd_rows (planilha WXD tem essa coluna)
ALTER TABLE public.wxd_rows ADD COLUMN IF NOT EXISTS dt_embarque timestamptz;

-- 3. Tornar user_id opcional em uploads (acesso público sem login)
ALTER TABLE public.uploads ALTER COLUMN user_id DROP NOT NULL;

-- 4. Remover RLS antigas e criar políticas de acesso público (sem login)
DROP POLICY IF EXISTS "Users can view own uploads" ON public.uploads;
DROP POLICY IF EXISTS "Users can create uploads" ON public.uploads;
DROP POLICY IF EXISTS "Users can delete own uploads" ON public.uploads;
DROP POLICY IF EXISTS "Users can update own uploads" ON public.uploads;

DROP POLICY IF EXISTS "Users can view own wku" ON public.wku_rows;
DROP POLICY IF EXISTS "Users can insert own wku" ON public.wku_rows;
DROP POLICY IF EXISTS "Users can delete own wku" ON public.wku_rows;

DROP POLICY IF EXISTS "Users can view own wmg" ON public.wmg_rows;
DROP POLICY IF EXISTS "Users can insert own wmg" ON public.wmg_rows;
DROP POLICY IF EXISTS "Users can delete own wmg" ON public.wmg_rows;

DROP POLICY IF EXISTS "Users can view own wdu" ON public.wxd_rows;
DROP POLICY IF EXISTS "Users can insert own wdu" ON public.wxd_rows;
DROP POLICY IF EXISTS "Users can delete own wdu" ON public.wxd_rows;

-- Acesso público total (qualquer um pode ler/inserir/excluir)
CREATE POLICY "Public read uploads" ON public.uploads FOR SELECT USING (true);
CREATE POLICY "Public write uploads" ON public.uploads FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete uploads" ON public.uploads FOR DELETE USING (true);
CREATE POLICY "Public update uploads" ON public.uploads FOR UPDATE USING (true);

CREATE POLICY "Public read wku" ON public.wku_rows FOR SELECT USING (true);
CREATE POLICY "Public write wku" ON public.wku_rows FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete wku" ON public.wku_rows FOR DELETE USING (true);

CREATE POLICY "Public read wmg" ON public.wmg_rows FOR SELECT USING (true);
CREATE POLICY "Public write wmg" ON public.wmg_rows FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete wmg" ON public.wmg_rows FOR DELETE USING (true);

CREATE POLICY "Public read wxd" ON public.wxd_rows FOR SELECT USING (true);
CREATE POLICY "Public write wxd" ON public.wxd_rows FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete wxd" ON public.wxd_rows FOR DELETE USING (true);
