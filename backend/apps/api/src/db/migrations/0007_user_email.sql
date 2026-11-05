-- Email for notifications. Filled from Privy on an email / Google sign-in (verified), or typed in
-- Profile by wallet users (unverified). POST /auth/email; see users.ts.
alter table users
  add column email text,
  add column email_verified_at timestamptz;
