-- Clipover site database. Run ONCE in Supabase: SQL Editor -> New query -> paste all of this -> Run.
-- BEFORE RUNNING: change CHANGE_ME@example.com below to the email you will log in with.

create or replace function public.is_owner() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') = lower('billybob22634@gmail.com')   -- <== CHANGE ME
$$;

create table if not exists public.site (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.wishes (
  id bigint generated always as identity primary key,
  name text not null default 'A friend',
  text text not null,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.site enable row level security;
alter table public.wishes enable row level security;

drop policy if exists "site: anyone reads" on public.site;
create policy "site: anyone reads" on public.site for select using (true);
drop policy if exists "site: owner writes" on public.site;
create policy "site: owner writes" on public.site for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists "wishes: see approved" on public.wishes;
create policy "wishes: see approved" on public.wishes for select using (approved or public.is_owner());
drop policy if exists "wishes: anyone can send" on public.wishes;
create policy "wishes: anyone can send" on public.wishes for insert with check (char_length(text) between 1 and 200 and char_length(name) <= 30);
drop policy if exists "wishes: owner edits" on public.wishes;
create policy "wishes: owner edits" on public.wishes for update using (public.is_owner()) with check (public.is_owner());
drop policy if exists "wishes: owner deletes" on public.wishes;
create policy "wishes: owner deletes" on public.wishes for delete using (public.is_owner());

grant usage on schema public to anon, authenticated;
grant select on public.site to anon, authenticated;
grant insert, update, delete on public.site to authenticated;
grant select, insert on public.wishes to anon;
grant select, insert, update, delete on public.wishes to authenticated;

insert into public.site (key, value) values ('settings', '{}'), ('events', '{"events": []}') on conflict (key) do nothing;

-- Auto-approver: runs on every new wish. Uses the blocked words and "block links" setting you edit in the site's Settings.
-- Wishes that trip the filter are kept but hidden; you can approve or delete them in Settings.
create or replace function public.wish_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cfg jsonb; w text; n text; sq text; hit boolean := false; b text; bs text;
begin
  if (select count(*) from public.wishes where created_at > now() - interval '1 minute') >= 10 then
    raise exception 'Too many wishes right now, try again in a minute';
  end if;
  new.name := left(coalesce(nullif(trim(new.name), ''), 'A friend'), 30);
  new.text := left(trim(new.text), 200);
  select value -> 'wishes' into cfg from public.site where key = 'settings';
  w := new.name || ' ' || new.text;
  if coalesce((cfg ->> 'blockLinks')::boolean, true) and w ~* '(https?://|www\.|\.(com|net|org|gg|io|ru|xyz)\y|discord\.gg)' then hit := true; end if;
  n := translate(lower(w), '0@1!|345$7', 'oaiiieasst');
  sq := regexp_replace(regexp_replace(n, '[^a-z]', '', 'g'), '(.)\1+', '\1', 'g');
  for b in select jsonb_array_elements_text(coalesce(cfg -> 'words', '[]'::jsonb)) loop
    b := regexp_replace(translate(lower(trim(b)), '0@1!|345$7', 'oaiiieasst'), '[^a-z ]', '', 'g');
    continue when b = '';
    if position(' ' in b) > 0 then
      if position(b in n) > 0 then hit := true; end if;
    else
      bs := regexp_replace(b, '(.)\1+', '\1', 'g');
      if b = any(regexp_split_to_array(n, '[^a-z]+')) or (char_length(bs) >= 4 and position(bs in sq) > 0) then hit := true; end if;
    end if;
  end loop;
  new.approved := not hit;
  return new;
end $$;

drop trigger if exists wish_check on public.wishes;
create trigger wish_check before insert on public.wishes for each row execute function public.wish_check();
