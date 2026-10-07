-- Degamed: initial schema (milestone 1).
-- Run in the Supabase SQL editor, or with `supabase db push`.
-- Every table has row-level security: users can only change their own data.

-- ─── Profiles ──────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text check (char_length(display_name) <= 60),
  avatar_url text,
  experience text not null default 'beginner' check (experience in ('beginner', 'experienced')),
  preferred_language text not null default 'python' check (preferred_language in ('python', 'javascript')),
  plan text not null default 'free' check (plan in ('free', 'creator', 'pro')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are public"
  on public.profiles for select using (true);

-- Users may edit their own profile, but never their plan (only the server, via payments, sets that).
create policy "Users update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and plan = (select p.plan from public.profiles p where p.id = auth.uid()));

-- Create a profile automatically when someone signs up (Google or email).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 60),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Projects ──────────────────────────────────────────────────────────────
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  description text check (char_length(description) <= 2000),
  art_style text not null default 'neon' check (art_style in ('neon', 'pastel', 'paper', 'flat', 'ink', 'retro')),
  language text not null default 'python' check (language in ('python', 'javascript')),
  visibility text not null default 'private' check (visibility in ('private', 'unlisted', 'public')),
  current_version_id uuid,
  remixed_from uuid references public.projects (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_owner_updated_idx on public.projects (owner_id, updated_at desc);

alter table public.projects enable row level security;

create policy "Owners read their projects; anyone reads shared ones"
  on public.projects for select
  using (owner_id = auth.uid() or visibility in ('public', 'unlisted'));

create policy "Owners create projects"
  on public.projects for insert with check (owner_id = auth.uid());

create policy "Owners update projects"
  on public.projects for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "Owners delete projects"
  on public.projects for delete using (owner_id = auth.uid());

create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.touch_updated_at();

-- ─── Versions ──────────────────────────────────────────────────────────────
-- File contents live in Cloudflare R2 (content-addressed), so this table stays tiny:
-- each row points at a manifest object listing { path → content hash }.
create table public.versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  manifest_key text not null,
  message text check (char_length(message) <= 500),
  created_by text not null check (created_by in ('ai', 'user')),
  created_at timestamptz not null default now()
);

create index versions_project_created_idx on public.versions (project_id, created_at desc);

alter table public.projects
  add constraint projects_current_version_fk
  foreign key (current_version_id) references public.versions (id) on delete set null;

alter table public.versions enable row level security;

create policy "Versions follow their project's visibility"
  on public.versions for select
  using (exists (
    select 1 from public.projects p
    where p.id = project_id and (p.owner_id = auth.uid() or p.visibility in ('public', 'unlisted'))
  ));

create policy "Owners add versions"
  on public.versions for insert
  with check (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));
