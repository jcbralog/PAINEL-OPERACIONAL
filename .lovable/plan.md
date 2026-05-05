# Dashboard de Operação — WKU + WMG + WDU

## Estrutura confirmada das planilhas

**WKU** (4.135 linhas, 2.242 pedidos, 408 SKUs) — base da operação:
`Cliente | No. Ped. Cli. | Dt. Conf. Sep. | Cód. Merc. | Nome Mercadoria | Qt. Ítem | % Sep. | % Cko.`

**WMG** — cadastro com `Cód. Merc. | Fator | Nome Mercadoria`. Cada SKU pode ter 2 linhas: Fator=1 (UND) e Fator>1 (CAIXA, ex: 18, 48).

**WDU** — `Cliente | No. Ped. Cli. | Sit. Fase` com fases: `Emb. Conf.`, `N.F. Conf.`, `Em Digit.`

## Regras de negócio (confirmadas)

1. **Separado** = linha com `% Sep. = 100`
2. **Checkout** = linha com `% Cko. = 100`
3. **Expedido** = pedido cuja `Sit. Fase` na WDU é `Emb. Conf.` (cruzado por `No. Ped. Cli.`)
4. **Caixas vs fracionado** (por linha WKU):
   - Buscar o **maior Fator** do SKU na WMG (`fator_caixa`)
   - Se `fator_caixa = 1` ou inexistente → `caixas=0`, `fracionado=Qt.Ítem`
   - Senão → `caixas = floor(Qt.Ítem / fator_caixa)`, `fracionado = Qt.Ítem mod fator_caixa`
   - Sem arredondar; mostrar quantos vieram fracionados

## Arquitetura

### Banco (Lovable Cloud / Supabase)

```text
uploads
  id (uuid, pk)
  user_id (uuid, fk auth.users)
  uploaded_at (timestamptz)
  reference_date (date)         -- data de referência da operação
  notes (text)

wku_rows                         -- linha-a-linha
  id, upload_id (fk), cliente, pedido, dt_conf_sep, sku, nome, qt_item,
  pct_sep, pct_cko, fator_caixa (int, snapshot da WMG),
  caixas (int), fracionado (numeric)

wmg_rows
  id, upload_id, sku, fator, nome
  -- índice (upload_id, sku, fator)

wdu_rows
  id, upload_id, cliente, pedido, sit_fase
  -- índice (upload_id, pedido)
```

RLS: cada usuário só lê/escreve seus próprios `uploads` e linhas filhas (via `upload_id`).

### Server functions (`src/server/operation.functions.ts`)

- `uploadOperation({ wku, wmg, wdu, referenceDate })` — recebe os 3 arquivos em base64, faz parse com `xlsx` (SheetJS), calcula `fator_caixa`/`caixas`/`fracionado` por linha WKU, persiste tudo em transação. Retorna `upload_id`.
- `listUploads()` — histórico para o seletor.
- `getDashboard({ upload_id, filters })` — retorna todos os agregados (KPIs, séries, top SKUs, top clientes) já calculados via SQL.

### Cruzamentos (SQL no `getDashboard`)

```sql
-- fator_caixa por SKU (já materializado em wku_rows no upload)
-- KPIs principais:
SELECT
  COUNT(*)                                AS linhas_total,
  COUNT(*) FILTER (WHERE pct_sep = 100)   AS linhas_separadas,
  COUNT(DISTINCT pedido)                  AS pedidos_total,
  COUNT(DISTINCT pedido) FILTER (WHERE pct_sep = 100) AS pedidos_separados,
  COUNT(DISTINCT sku)                     AS skus_total,
  COUNT(*) FILTER (WHERE pct_cko = 100)   AS linhas_checkout,
  SUM(caixas)                             AS caixas_total,
  SUM(fracionado)                         AS unidades_fracionadas,
  SUM(qt_item)                            AS unidades_total
FROM wku_rows WHERE upload_id = $1;

-- Expedidos (join WKU x WDU)
SELECT COUNT(DISTINCT w.pedido) FILTER (WHERE d.sit_fase = 'Emb. Conf.') AS expedidos
FROM wku_rows w LEFT JOIN wdu_rows d
  ON d.upload_id = w.upload_id AND d.pedido = w.pedido
WHERE w.upload_id = $1;
```

## Dashboard (rota `/dashboard`)

### Layout

```text
┌─ Header: seletor de upload + botão "Novo upload" + filtros ──┐
│  Filtros: período (Dt.Conf.Sep), SKU (multi), Status (sep/cko/exp), Cliente │
├──────────────────────────────────────────────────────────────┤
│  KPI cards (6):                                              │
│  • Pedidos separados (X / Y)   • % Separação (barra)        │
│  • Linhas em checkout 100%     • % Checkout (barra)         │
│  • Caixas movimentadas         • Unidades fracionadas       │
│  • Pedidos expedidos (Emb.Conf.) com barra de progresso     │
├──────────────────────────────────────────────────────────────┤
│  Gráfico 1: Funil  Separado → Checkout → Expedido (pedidos) │
│  Gráfico 2: Linha — separações por hora (Dt.Conf.Sep)       │
├──────────────────────────────────────────────────────────────┤
│  Gráfico 3: Barras — Top 15 SKUs por caixas                 │
│  Gráfico 4: Donut — distribuição Sit.Fase (WDU)             │
├──────────────────────────────────────────────────────────────┤
│  Tabela: pedidos com badges (Sep% / Cko% / Fase) + busca    │
└──────────────────────────────────────────────────────────────┘
```

### Componentes

- `shadcn/ui` (Card, Tabs, Table, Badge, Progress, Select, DateRangePicker)
- `recharts` para gráficos
- `react-dropzone` + `xlsx` para upload (parsing acontece no server)

## Telas

1. `/` — landing simples com CTA "Acessar dashboard" (login)
2. `/auth` — login/signup (email+senha, autoconfirm)
3. `/upload` — wizard de 3 passos (anexar WKU, WMG, WDU + data de referência)
4. `/dashboard` — visão consolidada (descrita acima)
5. `/historico` — lista de uploads anteriores

## Detalhes técnicos

- Parsing: `xlsx` (SheetJS) no server (`createServerFn`), sem depender de binários nativos
- `fator_caixa` é calculado **no upload** e gravado em `wku_rows` para deixar o dashboard rápido (sem joins complexos a cada filtro)
- Filtros aplicados via querystring na rota → re-fetch do `getDashboard`
- Tema: dark com acento azul (Tailwind), foco em densidade de informação

## Entregáveis

1. Migration do schema + RLS
2. Páginas Auth, Upload, Dashboard, Histórico
3. Server functions: `uploadOperation`, `listUploads`, `getDashboard`
4. Componentes de KPI/gráficos reutilizáveis

Pronto para implementar quando aprovar.