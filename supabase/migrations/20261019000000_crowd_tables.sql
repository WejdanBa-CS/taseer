-- جداول تقارير تسعير (متوسط الورشة + تعليقات السيارات)
-- الوصول من الخادم فقط عبر service_role؛ RLS مفعّل بدون سياسات للعامة.

create table if not exists public.quotes (
  device text not null,
  brand text not null,
  model text not null,
  year_label text not null,
  part text not null,
  city text not null,
  quote double precision not null,
  updated_at bigint not null,
  primary key (device, brand, model, year_label, part)
);

create index if not exists quotes_part_idx
  on public.quotes (brand, model, year_label, part);

create table if not exists public.car_notes (
  device text not null,
  brand text not null,
  model text not null,
  city text not null,
  price double precision,
  includes_fuel boolean not null default false,
  body text not null,
  updated_at bigint not null,
  primary key (device, brand, model)
);

create index if not exists car_notes_brand_idx
  on public.car_notes (brand, updated_at desc);

alter table public.quotes enable row level security;
alter table public.car_notes enable row level security;

revoke all on public.quotes from anon, authenticated;
revoke all on public.car_notes from anon, authenticated;
