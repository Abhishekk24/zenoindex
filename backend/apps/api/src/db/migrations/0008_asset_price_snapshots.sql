-- Daily price per registered asset (USDG per whole token, from the factory's price table), taken by the NAV worker.
-- Feeds the 24h / 30d change on GET /assets; see stats.ts.
create table asset_price_snapshots (
  project_id uuid not null references projects(id),
  asset_address text not null,
  observed_at timestamptz not null default now(),
  price text not null,
  primary key (project_id, asset_address, observed_at)
);
