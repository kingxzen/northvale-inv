create extension if not exists pgcrypto;

create type public.user_role as enum ('admin', 'staff');
create type public.inventory_category as enum ('raw', 'packaging', 'finished', 'asset');
create type public.inventory_unit as enum ('ml', 'liter', 'g', 'kg', 'gallon', 'pcs');
create type public.production_status as enum ('draft', 'planned', 'ready', 'blocked', 'completed');
create type public.stock_transaction_type as enum (
  'stock_in',
  'stock_out',
  'adjustment',
  'production_consume',
  'production_output'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'staff',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  category public.inventory_category not null,
  unit public.inventory_unit not null,
  quantity_on_hand numeric(14, 4) not null default 0 check (quantity_on_hand >= 0),
  reorder_point numeric(14, 4) not null default 0 check (reorder_point >= 0),
  location_id uuid references public.locations(id),
  unit_cost numeric(14, 4) check (unit_cost is null or unit_cost >= 0),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  output_unit public.inventory_unit not null,
  batch_size numeric(14, 4) not null check (batch_size > 0),
  finished_good_item_id uuid not null references public.inventory_items(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_bom_lines (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id),
  quantity_per_batch numeric(14, 4) not null check (quantity_per_batch > 0),
  unit public.inventory_unit not null,
  line_type text not null check (line_type in ('raw_material', 'packaging')),
  created_at timestamptz not null default now()
);

create table public.production_jobs (
  id uuid primary key default gen_random_uuid(),
  job_number text not null unique,
  product_id uuid not null references public.products(id),
  planned_batch_qty integer not null check (planned_batch_qty > 0),
  status public.production_status not null default 'draft',
  scheduled_for timestamptz,
  notes text,
  created_by uuid references public.profiles(id),
  completed_by uuid references public.profiles(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.production_job_lines (
  id uuid primary key default gen_random_uuid(),
  production_job_id uuid not null references public.production_jobs(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id),
  planned_qty numeric(14, 4) not null check (planned_qty > 0),
  actual_qty numeric(14, 4) check (actual_qty is null or actual_qty >= 0),
  unit public.inventory_unit not null,
  created_at timestamptz not null default now()
);

create table public.stock_transactions (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id),
  type public.stock_transaction_type not null,
  quantity numeric(14, 4) not null check (quantity > 0),
  unit public.inventory_unit not null,
  reason text,
  production_job_id uuid references public.production_jobs(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint adjustment_requires_reason check (type <> 'adjustment' or length(trim(coalesce(reason, ''))) > 0)
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_user_role() = 'admin', false)
$$;

create or replace function public.can_convert_unit(from_unit public.inventory_unit, to_unit public.inventory_unit)
returns boolean
language sql
immutable
as $$
  select from_unit = to_unit
    or (from_unit = 'ml' and to_unit = 'liter')
    or (from_unit = 'liter' and to_unit = 'ml')
    or (from_unit = 'g' and to_unit = 'kg')
    or (from_unit = 'kg' and to_unit = 'g')
    or (from_unit = 'gallon' and to_unit = 'liter')
    or (from_unit = 'liter' and to_unit = 'gallon')
$$;

create or replace function public.convert_unit(qty numeric, from_unit public.inventory_unit, to_unit public.inventory_unit)
returns numeric
language plpgsql
immutable
as $$
begin
  if from_unit = to_unit then
    return qty;
  elsif from_unit = 'ml' and to_unit = 'liter' then
    return qty / 1000;
  elsif from_unit = 'liter' and to_unit = 'ml' then
    return qty * 1000;
  elsif from_unit = 'g' and to_unit = 'kg' then
    return qty / 1000;
  elsif from_unit = 'kg' and to_unit = 'g' then
    return qty * 1000;
  elsif from_unit = 'gallon' and to_unit = 'liter' then
    return qty * 3.78541;
  elsif from_unit = 'liter' and to_unit = 'gallon' then
    return qty / 3.78541;
  end if;

  raise exception 'Unsupported conversion from % to %', from_unit, to_unit;
end;
$$;

create or replace function public.log_activity(
  action_name text,
  entity_name text,
  target_id uuid,
  extra jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), action_name, entity_name, target_id, extra);
end;
$$;

create or replace function public.log_table_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  action_name text;
begin
  if tg_op = 'DELETE' then
    target_id := old.id;
  else
    target_id := new.id;
  end if;

  action_name := lower(tg_op) || ' ' || tg_table_name;

  insert into public.activity_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    action_name,
    tg_table_name,
    target_id,
    jsonb_build_object('operation', tg_op)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.complete_production_job(target_job_id uuid)
returns table (
  transaction_id uuid,
  inventory_item_id uuid,
  type public.stock_transaction_type,
  quantity numeric,
  unit public.inventory_unit
)
language plpgsql
security definer
set search_path = public
as $$
declare
  job_record public.production_jobs%rowtype;
  product_record public.products%rowtype;
  bom_record public.product_bom_lines%rowtype;
  item_record public.inventory_items%rowtype;
  required_qty numeric;
  new_transaction_id uuid;
begin
  select * into job_record
  from public.production_jobs
  where id = target_job_id
  for update;

  if not found then
    raise exception 'Production job not found';
  end if;

  if job_record.status in ('draft', 'planned') then
    raise exception 'Draft and planned production jobs do not deduct inventory';
  end if;

  if job_record.status = 'completed' then
    raise exception 'Production job is already completed';
  end if;

  select * into product_record
  from public.products
  where id = job_record.product_id;

  for bom_record in
    select * from public.product_bom_lines where product_id = product_record.id
  loop
    select * into item_record
    from public.inventory_items
    where id = bom_record.inventory_item_id
    for update;

    if not public.can_convert_unit(bom_record.unit, item_record.unit) then
      raise exception 'Unsupported BOM conversion from % to %', bom_record.unit, item_record.unit;
    end if;

    required_qty := public.convert_unit(
      bom_record.quantity_per_batch * job_record.planned_batch_qty,
      bom_record.unit,
      item_record.unit
    );

    if item_record.quantity_on_hand < required_qty then
      raise exception 'Insufficient stock for %: need %, have %', item_record.name, required_qty, item_record.quantity_on_hand;
    end if;

    update public.inventory_items
    set quantity_on_hand = quantity_on_hand - required_qty,
        updated_at = now()
    where id = item_record.id;

    insert into public.stock_transactions (
      inventory_item_id,
      type,
      quantity,
      unit,
      production_job_id,
      created_by
    )
    values (
      item_record.id,
      'production_consume',
      required_qty,
      item_record.unit,
      job_record.id,
      auth.uid()
    )
    returning id into new_transaction_id;

    return query select new_transaction_id, item_record.id, 'production_consume'::public.stock_transaction_type, required_qty, item_record.unit;
  end loop;

  update public.inventory_items
  set quantity_on_hand = quantity_on_hand + (product_record.batch_size * job_record.planned_batch_qty),
      updated_at = now()
  where id = product_record.finished_good_item_id;

  insert into public.stock_transactions (
    inventory_item_id,
    type,
    quantity,
    unit,
    production_job_id,
    created_by
  )
  values (
    product_record.finished_good_item_id,
    'production_output',
    product_record.batch_size * job_record.planned_batch_qty,
    product_record.output_unit,
    job_record.id,
    auth.uid()
  )
  returning id into new_transaction_id;

  update public.production_jobs
  set status = 'completed',
      completed_at = now(),
      completed_by = auth.uid(),
      updated_at = now()
  where id = job_record.id;

  perform public.log_activity('completed production job', 'production_job', job_record.id);

  return query select new_transaction_id, product_record.finished_good_item_id, 'production_output'::public.stock_transaction_type, product_record.batch_size * job_record.planned_batch_qty, product_record.output_unit;
end;
$$;

alter table public.profiles enable row level security;
alter table public.locations enable row level security;
alter table public.inventory_items enable row level security;
alter table public.products enable row level security;
alter table public.product_bom_lines enable row level security;
alter table public.production_jobs enable row level security;
alter table public.production_job_lines enable row level security;
alter table public.stock_transactions enable row level security;
alter table public.activity_logs enable row level security;

create policy "profiles read own or admin" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles admin manage" on public.profiles for all using (public.is_admin()) with check (public.is_admin());

create policy "authenticated read locations" on public.locations for select using (auth.role() = 'authenticated');
create policy "admin manage locations" on public.locations for all using (public.is_admin()) with check (public.is_admin());

create policy "authenticated read inventory" on public.inventory_items for select using (auth.role() = 'authenticated');
create policy "staff insert update inventory" on public.inventory_items for insert with check (auth.role() = 'authenticated');
create policy "staff update inventory" on public.inventory_items for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin delete inventory" on public.inventory_items for delete using (public.is_admin());

create policy "authenticated read products" on public.products for select using (auth.role() = 'authenticated');
create policy "admin manage products" on public.products for all using (public.is_admin()) with check (public.is_admin());

create policy "authenticated read bom" on public.product_bom_lines for select using (auth.role() = 'authenticated');
create policy "admin manage bom" on public.product_bom_lines for all using (public.is_admin()) with check (public.is_admin());

create policy "authenticated read jobs" on public.production_jobs for select using (auth.role() = 'authenticated');
create policy "staff create jobs" on public.production_jobs for insert with check (auth.role() = 'authenticated');
create policy "staff update jobs" on public.production_jobs for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin delete jobs" on public.production_jobs for delete using (public.is_admin());

create policy "authenticated read job lines" on public.production_job_lines for select using (auth.role() = 'authenticated');
create policy "staff write job lines" on public.production_job_lines for insert with check (auth.role() = 'authenticated');
create policy "staff update job lines" on public.production_job_lines for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin delete job lines" on public.production_job_lines for delete using (public.is_admin());

create policy "authenticated read transactions" on public.stock_transactions for select using (auth.role() = 'authenticated');
create policy "staff create transactions" on public.stock_transactions for insert with check (auth.role() = 'authenticated');
create policy "admin delete transactions" on public.stock_transactions for delete using (public.is_admin());

create policy "authenticated read activity" on public.activity_logs for select using (auth.role() = 'authenticated');
create policy "system insert activity" on public.activity_logs for insert with check (auth.role() = 'authenticated');
create policy "admin delete activity" on public.activity_logs for delete using (public.is_admin());

create trigger audit_locations
after insert or update or delete on public.locations
for each row execute function public.log_table_change();

create trigger audit_inventory_items
after insert or update or delete on public.inventory_items
for each row execute function public.log_table_change();

create trigger audit_products
after insert or update or delete on public.products
for each row execute function public.log_table_change();

create trigger audit_product_bom_lines
after insert or update or delete on public.product_bom_lines
for each row execute function public.log_table_change();

create trigger audit_production_jobs
after insert or update or delete on public.production_jobs
for each row execute function public.log_table_change();

create trigger audit_production_job_lines
after insert or update or delete on public.production_job_lines
for each row execute function public.log_table_change();

create trigger audit_stock_transactions
after insert or update or delete on public.stock_transactions
for each row execute function public.log_table_change();
