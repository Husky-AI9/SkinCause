create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  brand text,
  category text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table public.routine_periods (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  cadence text not null,
  time_of_day text not null,
  created_at timestamptz not null default now()
);

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null,
  provider text not null,
  external_task_id text,
  captured_at timestamptz,
  image_path text,
  retain_image boolean not null default false,
  client_request_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, client_request_id)
);

create table public.scan_concerns (
  scan_id uuid not null references public.scans(id) on delete cascade,
  concern_key text not null,
  raw_score numeric,
  normalized_severity numeric check (normalized_severity between 0 and 100),
  direction_source text not null,
  primary key (scan_id, concern_key)
);

create table public.experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('elimination', 'reintroduction')),
  suspect_product_id uuid not null references public.products(id),
  status text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  hypothesis text not null
);

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  scan_id uuid references public.scans(id) on delete set null,
  adherence numeric not null check (adherence between 0 and 100),
  observations jsonb not null default '{}',
  notes text,
  occurred_at timestamptz not null
);

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.routine_periods enable row level security;
alter table public.scans enable row level security;
alter table public.scan_concerns enable row level security;
alter table public.experiments enable row level security;
alter table public.check_ins enable row level security;

create policy "profiles_owner" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "products_owner" on public.products for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "scans_owner" on public.scans for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "experiments_owner" on public.experiments for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "routine_periods_owner" on public.routine_periods for all
  using (exists (select 1 from public.products p where p.id = product_id and p.user_id = auth.uid()));
create policy "scan_concerns_owner" on public.scan_concerns for all
  using (exists (select 1 from public.scans s where s.id = scan_id and s.user_id = auth.uid()));
create policy "check_ins_owner" on public.check_ins for all
  using (exists (select 1 from public.experiments e where e.id = experiment_id and e.user_id = auth.uid()));
