-- IntegraRadar Stage 2 — feed registry, EOD reference and hard live-signal guard

create table if not exists public.market_data_sources (
  source_code text primary key,
  display_name text not null,
  provider text not null,
  asset_scope text[] not null default '{}',
  delivery text not null,
  latency_class text not null check (latency_class in ('REALTIME','DELAYED_15M','EOD','REFERENCE','UNKNOWN')),
  access_model text not null,
  cost_note text,
  license_note text,
  terms_url text,
  requires_credentials boolean not null default false,
  credentials_configured boolean not null default false,
  mobile_only_viable boolean not null default true,
  usable_for_live_scoring boolean not null default false,
  active boolean not null default false,
  selected_for_role text,
  rejection_reason text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.market_data_sources enable row level security;

create table if not exists public.futures_reference (
  id uuid primary key default gen_random_uuid(),
  ref_date date not null,
  symbol text not null,
  underlying_asset text not null,
  expiration_date date,
  close numeric, high numeric, low numeric, average numeric, settlement numeric,
  oscillation_pct numeric, trades numeric, volume numeric, financial_volume numeric,
  source text not null,
  latency_class text not null default 'EOD',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(ref_date, symbol, source)
);
alter table public.futures_reference enable row level security;
create index if not exists futures_reference_underlying_date_idx on public.futures_reference(underlying_asset, ref_date desc);

create or replace function public.integraradar_guard_signal_source()
returns trigger language plpgsql security invoker set search_path=public as $$
declare src text; allowed boolean; latency text;
begin
  src := coalesce(new.payload->>'source','');
  if src='' then raise exception 'signal payload must include source'; end if;
  select (active and usable_for_live_scoring), latency_class into allowed, latency
  from public.market_data_sources where source_code=src;
  if coalesce(allowed,false) is not true or latency <> 'REALTIME' then
    raise exception 'source % is not eligible for live signal scoring', src;
  end if;
  return new;
end; $$;

drop trigger if exists trg_integraradar_guard_signal_source on public.signals;
create trigger trg_integraradar_guard_signal_source
before insert on public.signals for each row execute function public.integraradar_guard_signal_source();

-- Provider registry is maintained in production with the current commercial/legal findings.
-- BRAPI_EOD is active only as EOD reference. No delayed/EOD source is allowed to create live signals.
