create extension if not exists pgcrypto;

create table if not exists public.market_snapshots (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null,
  asset text not null,
  source text not null,
  snapshot jsonb not null,
  analysis jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists market_snapshots_asset_ts_idx on public.market_snapshots(asset, ts desc);

create table if not exists public.signals (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null,
  asset text not null,
  price numeric,
  regime text,
  buy_score integer,
  sell_score integer,
  status text,
  setup text,
  payload jsonb not null,
  analysis jsonb not null,
  result_points numeric,
  mfe_points numeric,
  mae_points numeric,
  created_at timestamptz not null default now()
);
create index if not exists signals_asset_ts_idx on public.signals(asset, ts desc);

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  trade_date date not null default current_date,
  asset text not null default 'WIN',
  side text check (side in ('COMPRA','VENDA')),
  entry_price numeric,
  exit_price numeric,
  contracts integer not null default 2,
  pnl_brl numeric,
  setup text,
  followed_plan boolean,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.market_snapshots enable row level security;
alter table public.signals enable row level security;
alter table public.trades enable row level security;

-- Nenhuma policy pública por padrão. A API server-side usa service role.
