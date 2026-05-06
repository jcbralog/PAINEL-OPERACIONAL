-- Habilita extensão pgcrypto para UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabela de Uploads (Histórico)
CREATE TABLE IF NOT EXISTS public.uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_date DATE,
    notes TEXT,
    wku_count INTEGER DEFAULT 0,
    wmg_count INTEGER DEFAULT 0,
    wxd_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id TEXT,
    nome TEXT
);

-- Tabela de WKU (Pedidos / Separação)
CREATE TABLE IF NOT EXISTS public.wku_rows (
    id SERIAL PRIMARY KEY,
    upload_id UUID REFERENCES public.uploads(id) ON DELETE CASCADE,
    cliente TEXT,
    pedido TEXT,
    dt_conf_sep TEXT,
    sku TEXT,
    nome TEXT,
    qt_item INTEGER,
    pct_sep NUMERIC,
    pct_cko NUMERIC,
    caixas INTEGER DEFAULT 0,
    fracionado INTEGER DEFAULT 0,
    fator_caixa INTEGER DEFAULT 1
);

-- Tabela de WMG (Fatores)
CREATE TABLE IF NOT EXISTS public.wmg_rows (
    id SERIAL PRIMARY KEY,
    upload_id UUID REFERENCES public.uploads(id) ON DELETE CASCADE,
    sku TEXT,
    fator NUMERIC,
    nome TEXT
);

-- Tabela de WXD (Expedição)
CREATE TABLE IF NOT EXISTS public.wxd_rows (
    id SERIAL PRIMARY KEY,
    upload_id UUID REFERENCES public.uploads(id) ON DELETE CASCADE,
    cliente TEXT,
    pedido TEXT,
    dt_embarque TEXT,
    sit_fase TEXT
);

-- Habilitar RLS e Permissões Públicas
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wku_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wmg_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wxd_rows ENABLE ROW LEVEL SECURITY;

-- Permissões para uploads
CREATE POLICY "Public write uploads" ON public.uploads FOR INSERT TO public, anon, authenticated WITH CHECK (true);
CREATE POLICY "Public read uploads" ON public.uploads FOR SELECT TO public, anon, authenticated USING (true);
CREATE POLICY "Public update uploads" ON public.uploads FOR UPDATE TO public, anon, authenticated USING (true);
CREATE POLICY "Public delete uploads" ON public.uploads FOR DELETE TO public, anon, authenticated USING (true);

-- Permissões para WKU
CREATE POLICY "Public write wku" ON public.wku_rows FOR INSERT TO public, anon, authenticated WITH CHECK (true);
CREATE POLICY "Public read wku" ON public.wku_rows FOR SELECT TO public, anon, authenticated USING (true);
CREATE POLICY "Public delete wku" ON public.wku_rows FOR DELETE TO public, anon, authenticated USING (true);

-- Permissões para WMG
CREATE POLICY "Public write wmg" ON public.wmg_rows FOR INSERT TO public, anon, authenticated WITH CHECK (true);
CREATE POLICY "Public read wmg" ON public.wmg_rows FOR SELECT TO public, anon, authenticated USING (true);
CREATE POLICY "Public delete wmg" ON public.wmg_rows FOR DELETE TO public, anon, authenticated USING (true);

-- Permissões para WXD
CREATE POLICY "Public write wxd" ON public.wxd_rows FOR INSERT TO public, anon, authenticated WITH CHECK (true);
CREATE POLICY "Public read wxd" ON public.wxd_rows FOR SELECT TO public, anon, authenticated USING (true);
CREATE POLICY "Public delete wxd" ON public.wxd_rows FOR DELETE TO public, anon, authenticated USING (true);

-- (Tabelas criadas com sucesso)
