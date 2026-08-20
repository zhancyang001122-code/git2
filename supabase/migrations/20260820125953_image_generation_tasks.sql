create table if not exists public.image_generation_tasks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  image_slot text not null,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  image_url text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 day')
);

alter table public.image_generation_tasks enable row level security;

revoke all on table public.image_generation_tasks from anon, authenticated;

create index if not exists image_generation_tasks_user_status_idx
  on public.image_generation_tasks (user_id, status, created_at desc);

create index if not exists image_generation_tasks_expires_at_idx
  on public.image_generation_tasks (expires_at);

comment on table public.image_generation_tasks is
  'Server-only state for long-running managed image generations; accessed through the generate Edge Function.';
