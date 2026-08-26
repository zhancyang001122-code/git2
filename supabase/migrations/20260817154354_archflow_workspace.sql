create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  asset_type text not null,
  file_count integer not null default 0 check (file_count >= 0),
  source text not null,
  tone text not null default 'aqua',
  artifacts jsonb not null default '[]'::jsonb check (jsonb_typeof(artifacts) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.generation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_id text not null,
  prompt text not null,
  file_names jsonb not null default '[]'::jsonb check (jsonb_typeof(file_names) = 'array'),
  result_data jsonb,
  created_at timestamptz not null default now()
);

create index memos_user_created_idx on public.memos (user_id, created_at desc);
create index assets_user_created_idx on public.assets (user_id, created_at desc);
create index generation_history_user_created_idx on public.generation_history (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute procedure public.set_updated_at();
create trigger memos_set_updated_at before update on public.memos
for each row execute procedure public.set_updated_at();
create trigger assets_set_updated_at before update on public.assets
for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(new.email, '@', 1)),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'ArchFlow 用户')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.memos enable row level security;
alter table public.assets enable row level security;
alter table public.generation_history enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated
using ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "memos_select_own" on public.memos for select to authenticated
using ((select auth.uid()) = user_id);
create policy "memos_insert_own" on public.memos for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "memos_update_own" on public.memos for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "memos_delete_own" on public.memos for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "assets_select_own" on public.assets for select to authenticated
using ((select auth.uid()) = user_id);
create policy "assets_insert_own" on public.assets for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "assets_update_own" on public.assets for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "assets_delete_own" on public.assets for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "generation_history_select_own" on public.generation_history for select to authenticated
using ((select auth.uid()) = user_id);
create policy "generation_history_insert_own" on public.generation_history for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "generation_history_delete_own" on public.generation_history for delete to authenticated
using ((select auth.uid()) = user_id);

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.memos to authenticated;
grant select, insert, update, delete on public.assets to authenticated;
grant select, insert, delete on public.generation_history to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-assets',
  'user-assets',
  false,
  12582912,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "user_assets_select_own" on storage.objects for select to authenticated
using (bucket_id = 'user-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "user_assets_insert_own" on storage.objects for insert to authenticated
with check (bucket_id = 'user-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "user_assets_update_own" on storage.objects for update to authenticated
using (bucket_id = 'user-assets' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'user-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "user_assets_delete_own" on storage.objects for delete to authenticated
using (bucket_id = 'user-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
