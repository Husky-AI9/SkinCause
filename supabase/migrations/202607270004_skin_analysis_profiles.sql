alter table public.scans
  add column if not exists provider_version text,
  add column if not exists analysis_profile_version text not null default 'routine-sd-v1';

alter table public.scan_concerns
  add column if not exists ui_score numeric check (ui_score between 0 and 100),
  add column if not exists display_label text,
  add column if not exists experiment_role text
    check (experiment_role in ('primary', 'supporting', 'context'));

alter table public.experiments
  add column if not exists baseline_scan_id uuid references public.scans(id) on delete restrict,
  add column if not exists analysis_profile_version text not null default 'routine-sd-v1',
  add column if not exists primary_concerns text[] not null default array['redness']::text[];

create index if not exists experiments_baseline_scan_idx
  on public.experiments (baseline_scan_id);
