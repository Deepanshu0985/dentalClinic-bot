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
  transcript text not null default '',
  -- Filled in by the AI follow-up automation (src/lib/triage.ts).
  priority text check (priority is null or priority in ('urgent', 'high_value', 'routine')),
  ai_summary text not null default '',
  ai_reason text not null default '',
  reply_subject text not null default '',
  reply_body text not null default '',
  triaged_at timestamptz
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

create or replace function public.add_lead_v2(
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
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.check_leads_secret(p_secret);
  insert into public.leads (name, email, phone, treatment, preferred_time, notes, is_new_patient, transcript)
  values (p_name, p_email, p_phone, p_treatment, p_preferred_time, p_notes, p_is_new_patient, p_transcript)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.update_lead_triage(
  p_secret text,
  p_id uuid,
  p_priority text,
  p_ai_summary text,
  p_ai_reason text,
  p_reply_subject text,
  p_reply_body text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_leads_secret(p_secret);
  update public.leads
  set priority = p_priority,
      ai_summary = p_ai_summary,
      ai_reason = p_ai_reason,
      reply_subject = p_reply_subject,
      reply_body = p_reply_body,
      triaged_at = now()
  where id = p_id;
end;
$$;

create or replace function public.list_leads_v2(p_secret text)
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
revoke all on function public.add_lead_v2(text, text, text, text, text, text, text, boolean, text) from public, authenticated;
revoke all on function public.update_lead_triage(text, uuid, text, text, text, text, text) from public, authenticated;
revoke all on function public.list_leads_v2(text) from public, authenticated;
grant execute on function public.add_lead_v2(text, text, text, text, text, text, text, boolean, text) to anon;
grant execute on function public.update_lead_triage(text, uuid, text, text, text, text, text) to anon;
grant execute on function public.list_leads_v2(text) to anon;
