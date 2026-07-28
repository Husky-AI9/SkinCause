create table if not exists public.experiment_recommendations (
  experiment_id uuid primary key references public.experiments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  input_hash text not null,
  model text not null,
  recommendation jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.skin_simulations (
  experiment_id uuid primary key references public.experiments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_scan_id uuid references public.scans(id) on delete set null,
  target_scan_id uuid references public.scans(id) on delete set null,
  status text not null check (
    status in ('queued', 'processing', 'succeeded', 'failed', 'expired')
  ),
  provider text not null check (provider in ('youcam', 'mock')),
  provider_version text not null,
  external_task_id text,
  input_hash text not null,
  parameters jsonb not null,
  result_path text,
  result_mime_type text check (
    result_mime_type is null or result_mime_type in ('image/jpeg', 'image/png')
  ),
  error_code text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.experiment_recommendations enable row level security;
alter table public.skin_simulations enable row level security;

create policy "experiment_recommendations_owner"
  on public.experiment_recommendations
  for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.experiments e
      where e.id = experiment_id and e.user_id = auth.uid()
    )
  );

create policy "skin_simulations_owner"
  on public.skin_simulations
  for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.experiments e
      where e.id = experiment_id and e.user_id = auth.uid()
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'simulation-images',
  'simulation-images',
  false,
  10000000,
  array['image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No storage object policies are intentional. Simulation images are private,
-- short-lived, and only served through the authenticated application API.
