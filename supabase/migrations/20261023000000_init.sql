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
