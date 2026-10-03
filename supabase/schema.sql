-- Run this once in the Supabase SQL editor to store leads in a real database.
-- The app writes with the service role key from the server only, so row level
-- security stays on with no public policies (the table is not exposed to browsers).

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null default '',
  phone text not null default '',
  treatment text not null default '',
  preferred_time text not null default '',
  notes text not null default '',
  is_new_patient boolean not null default true,
  transcript text not null default ''
);

alter table public.leads enable row level security;
