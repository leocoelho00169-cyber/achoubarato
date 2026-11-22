-- Rode este arquivo UMA vez no Supabase: SQL Editor > New query > Run.
-- Ele só ADICIONA colunas/tabelas; não apaga nada da tabela "ofertas".

alter table public.ofertas add column if not exists descricao text;
alter table public.ofertas add column if not exists produto_id text;          -- id do produto na loja (evita duplicar)
alter table public.ofertas add column if not exists origem text default 'manual'; -- 'manual' | 'robo'
alter table public.ofertas add column if not exists enviado_telegram boolean default false;
alter table public.ofertas add column if not exists enviado_whatsapp boolean default false;

create unique index if not exists ofertas_loja_produto_uidx
  on public.ofertas (loja, produto_id) where produto_id is not null;

-- Histórico de preços (para dizer "menor preço já visto" / "abaixo da média")
create table if not exists public.historico_precos (
  id bigint generated always as identity primary key,
  loja text not null,
  produto_id text not null,
  titulo text,
  preco numeric(12,2) not null,
  created_at timestamptz default now()
);
create index if not exists historico_loja_produto_idx
  on public.historico_precos (loja, produto_id, created_at desc);

-- Fila de links colados por você (útil para Shein e qualquer loja sem API):
-- insira linhas com a url do produto; o robô busca preço/foto/descrição e publica.
create table if not exists public.fila_links (
  id bigint generated always as identity primary key,
  url text not null,
  loja text,                      -- opcional: 'Shein', 'Shopee', 'Mercado Livre'...
  status text default 'pendente', -- pendente | publicado | erro
  erro text,
  created_at timestamptz default now()
);

-- SEGURANÇA: o robô usa a chave service_role (ignora RLS). Para o site (chave anon),
-- deixe as novas tabelas fechadas:
alter table public.historico_precos enable row level security;
alter table public.fila_links enable row level security;
-- (sem policies = o site público não lê nem escreve nelas)
