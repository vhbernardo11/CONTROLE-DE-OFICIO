-- IntegraRadar Mobile — schema canônico
-- Este arquivo contém SOMENTE as estruturas do IntegraRadar.
-- O projeto Supabase reutilizado possui tabelas legadas de projetos antigos; elas são preservadas e não fazem parte deste schema.

create extension if not exists pgcrypto;

create table if not exists public.market_snapshots (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null,
  asset text not null,
  source text not null,
  source_delay_seconds integer,
  price numeric,
  snapshot jsonb not null default '{}'::jsonb,
  analysis jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists market_snapshots_asset_ts_idx on public.market_snapshots(asset, ts desc);
create index if not exists market_snapshots_source_ts_idx on public.market_snapshots(source, ts desc);

create table if not exists public.candles (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null,
  asset text not null,
  timeframe text not null,
  open numeric,
  high numeric,
  low numeric,
  close numeric,
  volume numeric,
  source text not null,
  is_realtime boolean not null default false,
  created_at timestamptz not null default now(),
  unique(asset,timeframe,ts,source)
);
create index if not exists candles_asset_tf_ts_idx on public.candles(asset,timeframe,ts desc);

create table if not exists public.flow_snapshots (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null,
  asset text not null,
  source text not null,
  buy_aggression numeric,
  sell_aggression numeric,
  delta numeric,
  cumulative_delta numeric,
  bid_ask_imbalance numeric,
  trade_rate numeric,
  absorption text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists flow_snapshots_asset_ts_idx on public.flow_snapshots(asset,ts desc);

create table if not exists public.context_snapshots (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null,
  source text not null,
  sp500 numeric,
  nasdaq numeric,
  vix numeric,
  dxy numeric,
  oil numeric,
  us10y numeric,
  usdbrl numeric,
  ibov numeric,
  petr4 numeric,
  vale3 numeric,
  banks jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists context_snapshots_ts_idx on public.context_snapshots(ts desc);

create table if not exists public.economic_events (
  id uuid primary key default gen_random_uuid(),
  event_ts timestamptz not null,
  country text,
  title text not null,
  impact text,
  source text,
  actual text,
  forecast text,
  previous text,
  veto_minutes_before integer not null default 5,
  veto_minutes_after integer not null default 10,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists economic_events_ts_idx on public.economic_events(event_ts);

create table if not exists public.signals (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null,
  asset text not null,
  price numeric,
  regime text,
  buy_score integer check (buy_score is null or buy_score between 0 and 100),
  sell_score integer check (sell_score is null or sell_score between 0 and 100),
  status text,
  setup text,
  stop_points numeric,
  target_points numeric,
  rr numeric,
  payload jsonb not null default '{}'::jsonb,
  analysis jsonb not null default '{}'::jsonb,
  result_points numeric,
  mfe_points numeric,
  mae_points numeric,
  result_checked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists signals_asset_ts_idx on public.signals(asset,ts desc);
create index if not exists signals_status_ts_idx on public.signals(status,ts desc);

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  trade_date date not null default current_date,
  opened_at timestamptz,
  closed_at timestamptz,
  asset text not null default 'WIN',
  side text check (side in ('COMPRA','VENDA')),
  entry_price numeric,
  exit_price numeric,
  contracts integer not null default 2 check (contracts > 0),
  stop_points numeric,
  target_points numeric,
  pnl_points numeric,
  pnl_brl numeric,
  setup text,
  signal_id uuid references public.signals(id) on delete set null,
  followed_plan boolean,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists trades_date_idx on public.trades(trade_date desc);
create index if not exists trades_signal_id_idx on public.trades(signal_id) where signal_id is not null;

create table if not exists public.daily_risk (
  trade_date date primary key default current_date,
  contracts integer not null default 2,
  max_loss_trade_brl numeric not null default 40,
  max_loss_day_brl numeric not null default 80,
  max_trades integer not null default 3,
  consecutive_losses integer not null default 0,
  realized_pnl_brl numeric not null default 0,
  trades_count integer not null default 0,
  locked boolean not null default false,
  lock_reason text,
  updated_at timestamptz not null default now(),
  constraint daily_risk_limits_positive check (contracts > 0 and max_loss_trade_brl > 0 and max_loss_day_brl > 0 and max_trades > 0)
);

create table if not exists public.source_health (
  source text primary key,
  last_seen_at timestamptz,
  status text not null default 'UNKNOWN',
  delay_seconds integer,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists source_health_updated_idx on public.source_health(updated_at desc);

create table if not exists public.ingest_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  token_hash text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table if not exists public.radar_system_meta (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.market_snapshots enable row level security;
alter table public.candles enable row level security;
alter table public.flow_snapshots enable row level security;
alter table public.context_snapshots enable row level security;
alter table public.economic_events enable row level security;
alter table public.signals enable row level security;
alter table public.trades enable row level security;
alter table public.daily_risk enable row level security;
alter table public.source_health enable row level security;
alter table public.ingest_keys enable row level security;
alter table public.radar_system_meta enable row level security;

-- Intencional: nenhuma policy pública nas tabelas do radar.
-- Leitura/gravação operacional ocorre por backend/Edge Functions com privilégios de serviço.

create or replace view public.integraradar_status with (security_invoker=true) as
select
  (select max(ts) from public.market_snapshots) as latest_market_ts,
  (select max(ts) from public.context_snapshots) as latest_context_ts,
  (select count(*) from public.signals) as signals_total,
  (select count(*) from public.trades) as trades_total,
  (select count(*) from public.source_health where status not in ('OK','HEALTHY')) as unhealthy_sources,
  (select locked from public.daily_risk order by trade_date desc limit 1) as risk_locked,
  (select realized_pnl_brl from public.daily_risk order by trade_date desc limit 1) as realized_pnl_brl;

insert into public.radar_system_meta(key,value) values
('app', jsonb_build_object('name','IntegraRadar Mobile','stage',1,'status','FOUNDATION_READY')),
('risk_defaults', jsonb_build_object('contracts',2,'point_value_brl',0.20,'max_trade_risk_brl',40,'max_daily_loss_brl',80,'max_trades_day',3,'max_consecutive_losses',2,'min_rr',1.5,'target_rr',2.0)),
('data_integrity', jsonb_build_object('rule','never_label_delayed_demo_or_inferred_data_as_realtime'))
on conflict (key) do update set value=excluded.value, updated_at=now();
