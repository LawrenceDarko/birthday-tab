-- Birthday Tab schema. Run once in the Supabase SQL editor.
-- All reads and writes go through the app's server routes with the service role key,
-- so row level security is on with no policies: the public anon key can do nothing.

create table if not exists bills (
  id          text primary key,
  admin_key   text not null,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists guests (
  bill_id     text not null references bills(id) on delete cascade,
  guest_id    text not null,          -- secret, kept in the guest's browser
  pid         text not null,          -- public id shown to others
  name        text not null default '',
  claims      jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (bill_id, guest_id)
);

create index if not exists guests_bill_idx on guests (bill_id);

alter table bills  enable row level security;
alter table guests enable row level security;

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
