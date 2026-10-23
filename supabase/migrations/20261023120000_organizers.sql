-- Organizer accounts: an organizer signs in to see and manage their bills from any device.

create table if not exists organizers (
  id             text primary key,
  email          text not null unique,   -- stored lowercased
  password_hash  text not null,          -- scrypt$<salt>$<hash>
  created_at     timestamptz not null default now()
);

create table if not exists sessions (
  token_hash    text primary key,        -- sha256 of the cookie value, never the value itself
  organizer_id  text not null references organizers(id) on delete cascade,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now()
);

alter table bills add column if not exists owner_id text references organizers(id) on delete set null;
create index if not exists bills_owner_idx on bills (owner_id);

alter table organizers enable row level security;
alter table sessions   enable row level security;
