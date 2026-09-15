create table if not exists public.radar_system_meta (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.radar_system_meta enable row level security;

insert into public.radar_system_meta(key,value) values
('app', jsonb_build_object('name','IntegraRadar Mobile','stage',1,'status','FOUNDATION_READY')),
('risk_defaults', jsonb_build_object('contracts',2,'point_value_brl',0.20,'max_trade_risk_brl',40,'max_daily_loss_brl',80,'max_trades_day',3,'max_consecutive_losses',2,'min_rr',1.5,'target_rr',2.0)),
('data_integrity', jsonb_build_object('rule','never_label_delayed_demo_or_inferred_data_as_realtime'))
on conflict (key) do update set value=excluded.value, updated_at=now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname='signals_buy_score_range') then
    alter table public.signals add constraint signals_buy_score_range check (buy_score is null or buy_score between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname='signals_sell_score_range') then
    alter table public.signals add constraint signals_sell_score_range check (sell_score is null or sell_score between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname='trades_contracts_positive') then
    alter table public.trades add constraint trades_contracts_positive check (contracts > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='daily_risk_limits_positive') then
    alter table public.daily_risk add constraint daily_risk_limits_positive check (contracts > 0 and max_loss_trade_brl > 0 and max_loss_day_brl > 0 and max_trades > 0);
  end if;
end $$;

create index if not exists source_health_updated_idx on public.source_health(updated_at desc);
create index if not exists signals_status_ts_idx on public.signals(status, ts desc);
create index if not exists market_snapshots_source_ts_idx on public.market_snapshots(source, ts desc);
create index if not exists trades_signal_id_idx on public.trades(signal_id) where signal_id is not null;

create or replace view public.integraradar_status with (security_invoker=true) as
select
  (select max(ts) from public.market_snapshots) as latest_market_ts,
  (select max(ts) from public.context_snapshots) as latest_context_ts,
  (select count(*) from public.signals) as signals_total,
  (select count(*) from public.trades) as trades_total,
  (select count(*) from public.source_health where status not in ('OK','HEALTHY')) as unhealthy_sources,
  (select locked from public.daily_risk order by trade_date desc limit 1) as risk_locked,
  (select realized_pnl_brl from public.daily_risk order by trade_date desc limit 1) as realized_pnl_brl;
