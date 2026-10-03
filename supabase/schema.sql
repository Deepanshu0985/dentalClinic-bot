-- Leads storage for the chatbot. Run once in the Supabase SQL editor.
--
-- The app talks to Supabase with the public (publishable/anon) key, so the
-- table itself is locked: row level security is on with no policies, and the
-- only way in is through two functions that check a shared secret
-- (SUPABASE_LEADS_SECRET on the server). Only its SHA-256 hash is stored here.

create extension if not exists pgcrypto with schema extensions;

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
revoke all on public.leads from anon, authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.settings (key text primary key, value text not null);

-- Replace the value with the SHA-256 hex digest of your SUPABASE_LEADS_SECRET:
--   node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1]).digest('hex'))" "<secret>"
insert into private.settings (key, value)
values ('leads_secret_sha256', '<sha256-of-your-secret>')
on conflict (key) do update set value = excluded.value;

create or replace function private.check_leads_secret(p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_secret is null or encode(extensions.digest(p_secret, 'sha256'), 'hex') is distinct from
     (select value from private.settings where key = 'leads_secret_sha256') then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.add_lead(
  p_secret text,
  p_name text,
  p_email text,
  p_phone text,
  p_treatment text,
  p_preferred_time text,
  p_notes text,
  p_is_new_patient boolean,
  p_transcript text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_leads_secret(p_secret);
  insert into public.leads (name, email, phone, treatment, preferred_time, notes, is_new_patient, transcript)
  values (p_name, p_email, p_phone, p_treatment, p_preferred_time, p_notes, p_is_new_patient, p_transcript);
end;
$$;

create or replace function public.list_leads(p_secret text)
returns setof public.leads
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_leads_secret(p_secret);
  return query select * from public.leads order by created_at desc limit 200;
end;
$$;

revoke all on function private.check_leads_secret(text) from public, anon, authenticated;
revoke all on function public.add_lead(text, text, text, text, text, text, text, boolean, text) from public;
revoke all on function public.list_leads(text) from public;
grant execute on function public.add_lead(text, text, text, text, text, text, text, boolean, text) to anon;
grant execute on function public.list_leads(text) to anon;
