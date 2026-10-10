-- Tenancy: an organization (customer) owns projects (one per DTF app); API keys belong to a project.
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  chain_id integer not null,
  factory_address text not null check (factory_address ~ '^0x[0-9a-f]{40}$'),
  siwe_domain text not null,
  siwe_uri text not null,
  created_at timestamptz not null default now()
);

create table api_keys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id),
  type text not null check (type in ('publishable', 'secret')),
  prefix text not null,
  key_hash text not null unique,
  name text,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

-- End users of a project, identified by the wallet they signed in with (SIWE).
create table users (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id),
  wallet_address text not null check (wallet_address ~ '^0x[0-9a-f]{40}$'),
  first_name text,
  last_name text,
  display_name text,
  country text,
  terms_accepted_at timestamptz,
  privacy_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, wallet_address)
);

create table sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  project_id uuid not null references projects(id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index sessions_user_id_idx on sessions (user_id);

-- Single-use SIWE nonces; consumed atomically on verify.
create table siwe_nonces (
  nonce text primary key,
  project_id uuid not null references projects(id),
  wallet_address text not null check (wallet_address ~ '^0x[0-9a-f]{40}$'),
  chain_id integer not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- Asset → USDG swap route for redeem legs (the chain stores no routes).
create table swap_paths (
  chain_id integer not null,
  asset_address text not null check (asset_address ~ '^0x[0-9a-f]{40}$'),
  path text[] not null,
  primary key (chain_id, asset_address)
);

create table operations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id),
  user_id uuid not null references users(id),
  wallet_address text not null,
  action text not null check (action in ('buy', 'redeem_request', 'redeem_swap', 'redeem_claim', 'redeem_claim_in_kind')),
  vault_address text not null,
  chain_id integer not null,
  tx_to text not null,
  tx_data text not null,
  tx_value numeric(78, 0) not null default 0,
  amount_raw numeric(78, 0),
  shares_raw numeric(78, 0),
  tx_hash text check (tx_hash ~ '^0x[0-9a-f]{64}$'),
  status text not null default 'draft_prepared' check (status in ('draft_prepared', 'submitted', 'confirmed', 'failed')),
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  confirmed_at timestamptz,
  failed_at timestamptz
);
create unique index operations_tx_hash_idx on operations (chain_id, tx_hash) where tx_hash is not null;
create index operations_user_vault_idx on operations (project_id, user_id, vault_address, created_at desc);
