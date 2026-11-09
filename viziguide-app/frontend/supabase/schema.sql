create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    full_name text,
    avatar_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.products (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    name text not null,
    category text,
    brand text,
    model text,
    serial_number text,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.diagnoses (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    product_id uuid references public.products (id) on delete set null,
    description text not null,
    image_url text,
    result jsonb not null default '{}'::jsonb,
    disclaimer text,
    status text not null default 'completed',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.diagnoses
    add column if not exists disclaimer text;

create table if not exists public.chat_messages (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    conversation_id uuid not null default gen_random_uuid(),
    role text not null check (role in ('user', 'assistant')),
    content text not null check (length(trim(content)) > 0),
    created_at timestamptz not null default now()
);

create table if not exists public.reminders (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    product_id uuid references public.products (id) on delete set null,
    title text not null,
    notes text,
    remind_at timestamptz,
    is_completed boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists products_user_id_idx on public.products (user_id);
create index if not exists diagnoses_user_created_idx on public.diagnoses (user_id, created_at desc);
create index if not exists diagnoses_product_id_idx on public.diagnoses (product_id);
create index if not exists chat_messages_user_conversation_created_idx
    on public.chat_messages (user_id, conversation_id, created_at);
create index if not exists reminders_user_remind_at_idx
    on public.reminders (user_id, remind_at);
create index if not exists reminders_product_id_idx on public.reminders (product_id);

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.diagnoses enable row level security;
alter table public.chat_messages enable row level security;
alter table public.reminders enable row level security;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.diagnoses to authenticated;
grant select, insert, update, delete on public.chat_messages to authenticated;
grant select, insert, update, delete on public.reminders to authenticated;

drop policy if exists "Users can manage their own profile" on public.profiles;
create policy "Users can manage their own profile"
    on public.profiles for all
    using ((select auth.uid()) = id)
    with check ((select auth.uid()) = id);

drop policy if exists "Users can manage their own products" on public.products;
create policy "Users can manage their own products"
    on public.products for all
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own diagnoses" on public.diagnoses;
create policy "Users can manage their own diagnoses"
    on public.diagnoses for all
    using ((select auth.uid()) = user_id)
    with check (
        (select auth.uid()) = user_id
        and (
            product_id is null
            or exists (
                select 1
                from public.products
                where products.id = diagnoses.product_id
                  and products.user_id = (select auth.uid())
            )
        )
    );

drop policy if exists "Users can manage their own chat messages" on public.chat_messages;
create policy "Users can manage their own chat messages"
    on public.chat_messages for all
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own reminders" on public.reminders;
create policy "Users can manage their own reminders"
    on public.reminders for all
    using ((select auth.uid()) = user_id)
    with check (
        (select auth.uid()) = user_id
        and (
            product_id is null
            or exists (
                select 1
                from public.products
                where products.id = reminders.product_id
                  and products.user_id = (select auth.uid())
            )
        )
    );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id, full_name, avatar_url)
    values (
        new.id,
        coalesce(
            nullif(new.raw_user_meta_data ->> 'full_name', ''),
            nullif(new.raw_user_meta_data ->> 'name', '')
        ),
        coalesce(
            nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
            nullif(new.raw_user_meta_data ->> 'picture', '')
        )
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
