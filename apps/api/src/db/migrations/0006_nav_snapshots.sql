-- Daily NAV snapshots per vault (src/stats.ts startNavWorker): the basket NAV chart and share-price changes.
create table nav_snapshots (
  project_id uuid not null references projects(id),
  vault_address text not null,
  observed_at timestamptz not null default now(),
  share_price text not null,
  nav text not null,
  total_supply_raw text not null,
  primary key (project_id, vault_address, observed_at)
);
