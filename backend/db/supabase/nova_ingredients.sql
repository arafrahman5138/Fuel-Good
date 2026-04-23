-- NOVA ingredient dictionary — tunable in prod via the Supabase dashboard.
-- Shipped defaults live in backend/app/data/nova_dict.json and are upserted
-- by backend/scripts/seed_nova_dict.py on deploy. Supabase rows override
-- shipped defaults at backend startup via app.services.nova.reload_dict.

create table if not exists public.nova_ingredients (
    name text primary key,
    nova smallint not null check (nova between 1 and 4),
    role text,
    tags jsonb not null default '[]'::jsonb,
    updated_at timestamptz not null default now()
);

create index if not exists nova_ingredients_role_idx on public.nova_ingredients (role);
create index if not exists nova_ingredients_updated_at_idx on public.nova_ingredients (updated_at desc);

-- Service role reads all; RLS off because this dictionary is non-personal
-- reference data intentionally readable to the backend service role.
alter table public.nova_ingredients disable row level security;

-- Track updates so the backend can detect freshness if we add polling later.
create or replace function public.set_nova_ingredients_updated_at() returns trigger
language plpgsql as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists nova_ingredients_updated_at on public.nova_ingredients;
create trigger nova_ingredients_updated_at
    before update on public.nova_ingredients
    for each row execute function public.set_nova_ingredients_updated_at();
