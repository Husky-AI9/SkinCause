alter table public.experiments
  drop constraint if exists experiments_suspect_product_id_fkey;

alter table public.experiments
  add constraint experiments_suspect_product_id_fkey
  foreign key (suspect_product_id)
  references public.products(id)
  on delete cascade;
