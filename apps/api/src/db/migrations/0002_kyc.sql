-- KYC via Didit, per user. Only the status is kept — no identity documents or personal data.
alter table users
  add column kyc_status text,
  add column kyc_session_id text,
  add column kyc_last_event_id text,
  add column kyc_updated_at timestamptz,
  add column kyc_approved_at timestamptz;
create unique index users_kyc_session_idx on users (kyc_session_id) where kyc_session_id is not null;
