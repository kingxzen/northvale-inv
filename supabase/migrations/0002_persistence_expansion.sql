alter type public.production_status add value if not exists 'to_process';
alter type public.production_status add value if not exists 'cancelled';

alter type public.stock_transaction_type add value if not exists 'production_release';
alter type public.stock_transaction_type add value if not exists 'quick_order_finished_good_out';
alter type public.stock_transaction_type add value if not exists 'quick_order_packing_material_out';

alter table public.locations
  add column if not exists legacy_id text unique,
  add column if not exists updated_at timestamptz not null default now();

alter table public.inventory_items
  add column if not exists legacy_id text unique,
  add column if not exists location_legacy_id text,
  add column if not exists status text not null default 'active' check (status in ('critical', 'low', 'good', 'active')),
  add column if not exists is_archived boolean not null default false;

alter table public.products
  add column if not exists legacy_id text unique,
  add column if not exists brand text,
  add column if not exists scent text,
  add column if not exists family text,
  add column if not exists category text,
  add column if not exists notes text,
  add column if not exists is_archived boolean not null default false;

alter table public.product_bom_lines
  add column if not exists legacy_id text unique,
  add column if not exists cost_override numeric(14, 4) check (cost_override is null or cost_override >= 0),
  add column if not exists wastage_percent numeric(8, 4) check (wastage_percent is null or wastage_percent >= 0),
  add column if not exists notes text;

alter table public.production_jobs
  add column if not exists legacy_id text unique,
  add column if not exists due_date timestamptz,
  add column if not exists purpose text check (purpose is null or purpose in ('stock', 'order', 'custom')),
  add column if not exists reference_note text,
  add column if not exists prepared_by text,
  add column if not exists started_at timestamptz,
  add column if not exists is_new boolean not null default false,
  add column if not exists is_archived boolean not null default false;

alter table public.production_job_lines
  add column if not exists legacy_id text unique,
  add column if not exists reason text;

create table if not exists public.production_product_lines (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  production_job_id uuid not null references public.production_jobs(id) on delete cascade,
  product_id uuid not null references public.products(id),
  planned_batch_qty numeric(14, 4) not null check (planned_batch_qty > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.production_additional_materials (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  production_job_id uuid not null references public.production_jobs(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id),
  quantity numeric(14, 4) not null check (quantity > 0),
  unit public.inventory_unit not null,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.master_boms (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  name text not null,
  family text not null default 'General',
  yield_qty numeric(14, 4) not null check (yield_qty > 0),
  yield_unit public.inventory_unit not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.master_bom_lines (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  master_bom_id uuid not null references public.master_boms(id) on delete cascade,
  line_type text not null check (line_type in ('raw_material', 'packaging', 'manpower', 'other_cost')),
  inventory_item_id uuid references public.inventory_items(id),
  quantity_per_batch numeric(14, 4) not null check (quantity_per_batch > 0),
  unit text not null,
  cost_override numeric(14, 4) check (cost_override is null or cost_override >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.product_bom_assignments (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  product_id uuid not null references public.products(id) on delete cascade,
  master_bom_id uuid references public.master_boms(id),
  type text not null default 'none' check (type in ('linked', 'custom', 'none')),
  custom_lines jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id)
);

create table if not exists public.packing_templates (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  name text not null,
  capacity numeric(14, 4) not null default 1 check (capacity > 0),
  basis text not null default 'per_set' check (basis in ('per_order', 'per_item', 'per_set')),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.packing_template_lines (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  packing_template_id uuid not null references public.packing_templates(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id),
  qty numeric(14, 4) not null check (qty > 0),
  unit public.inventory_unit not null,
  usage_rule text not null check (usage_rule in ('per_order', 'per_item', 'per_set')),
  created_at timestamptz not null default now()
);

create table if not exists public.quick_orders (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  status text not null default 'draft' check (status in ('draft', 'processed', 'packed', 'completed', 'cancelled', 'released')),
  platform text not null,
  reference_no text,
  target_ship_date timestamptz,
  prepared_by text,
  processed_by text,
  completed_by text,
  notes text,
  inventory_deducted boolean not null default false,
  processed_at timestamptz,
  packed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quick_order_lines (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  quick_order_id uuid not null references public.quick_orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric(14, 4) not null check (quantity > 0),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.quick_order_packing_groups (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  quick_order_id uuid not null references public.quick_orders(id) on delete cascade,
  packing_template_id uuid references public.packing_templates(id),
  assigned_line_ids jsonb not null default '[]'::jsonb,
  manual_sets text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.quick_order_materials (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  quick_order_id uuid not null references public.quick_orders(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id),
  name text not null,
  required numeric(14, 4) not null check (required >= 0),
  unit public.inventory_unit not null,
  cost numeric(14, 4) check (cost is null or cost >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.quick_order_logs (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  quick_order_id uuid not null references public.quick_orders(id) on delete cascade,
  text text not null,
  actor text not null,
  created_at timestamptz not null default now()
);

alter table public.stock_transactions
  add column if not exists legacy_id text unique,
  add column if not exists reference text,
  add column if not exists before_quantity numeric(14, 4),
  add column if not exists after_quantity numeric(14, 4),
  add column if not exists quick_order_id uuid references public.quick_orders(id);

alter table public.activity_logs
  add column if not exists legacy_id text unique,
  add column if not exists actor_name text,
  add column if not exists entity_legacy_id text;

create index if not exists idx_inventory_items_category_status_archive
  on public.inventory_items (category, status, is_archived);
create index if not exists idx_inventory_items_legacy_id
  on public.inventory_items (legacy_id);
create index if not exists idx_products_legacy_id
  on public.products (legacy_id);
create index if not exists idx_product_bom_lines_legacy_id
  on public.product_bom_lines (legacy_id);
create index if not exists idx_production_jobs_status_due_date
  on public.production_jobs (status, due_date);
create index if not exists idx_production_jobs_legacy_id
  on public.production_jobs (legacy_id);
create index if not exists idx_production_product_lines_job
  on public.production_product_lines (production_job_id);
create index if not exists idx_production_additional_materials_job
  on public.production_additional_materials (production_job_id);
create index if not exists idx_master_bom_lines_bom
  on public.master_bom_lines (master_bom_id);
create index if not exists idx_product_bom_assignments_product
  on public.product_bom_assignments (product_id);
create index if not exists idx_packing_template_lines_template
  on public.packing_template_lines (packing_template_id);
create index if not exists idx_quick_orders_status_platform_processed
  on public.quick_orders (status, platform, processed_at);
create index if not exists idx_quick_order_lines_order
  on public.quick_order_lines (quick_order_id);
create index if not exists idx_quick_order_materials_order
  on public.quick_order_materials (quick_order_id);
create index if not exists idx_stock_transactions_date_type_item
  on public.stock_transactions (created_at, type, inventory_item_id);
create index if not exists idx_stock_transactions_quick_order
  on public.stock_transactions (quick_order_id);
create index if not exists idx_activity_logs_entity_date
  on public.activity_logs (entity_type, entity_id, created_at);

alter table public.production_product_lines enable row level security;
alter table public.production_additional_materials enable row level security;
alter table public.master_boms enable row level security;
alter table public.master_bom_lines enable row level security;
alter table public.product_bom_assignments enable row level security;
alter table public.packing_templates enable row level security;
alter table public.packing_template_lines enable row level security;
alter table public.quick_orders enable row level security;
alter table public.quick_order_lines enable row level security;
alter table public.quick_order_packing_groups enable row level security;
alter table public.quick_order_materials enable row level security;
alter table public.quick_order_logs enable row level security;

create policy "authenticated read production product lines" on public.production_product_lines for select using (auth.role() = 'authenticated');
create policy "staff write production product lines" on public.production_product_lines for insert with check (auth.role() = 'authenticated');
create policy "staff update production product lines" on public.production_product_lines for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin delete production product lines" on public.production_product_lines for delete using (public.is_admin());

create policy "authenticated read production additional materials" on public.production_additional_materials for select using (auth.role() = 'authenticated');
create policy "staff write production additional materials" on public.production_additional_materials for insert with check (auth.role() = 'authenticated');
create policy "staff update production additional materials" on public.production_additional_materials for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin delete production additional materials" on public.production_additional_materials for delete using (public.is_admin());

create policy "authenticated read master boms" on public.master_boms for select using (auth.role() = 'authenticated');
create policy "staff write master boms" on public.master_boms for insert with check (auth.role() = 'authenticated');
create policy "staff update master boms" on public.master_boms for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin delete master boms" on public.master_boms for delete using (public.is_admin());

create policy "authenticated read master bom lines" on public.master_bom_lines for select using (auth.role() = 'authenticated');
create policy "staff write master bom lines" on public.master_bom_lines for insert with check (auth.role() = 'authenticated');
create policy "staff update master bom lines" on public.master_bom_lines for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin delete master bom lines" on public.master_bom_lines for delete using (public.is_admin());

create policy "authenticated read product bom assignments" on public.product_bom_assignments for select using (auth.role() = 'authenticated');
create policy "staff write product bom assignments" on public.product_bom_assignments for insert with check (auth.role() = 'authenticated');
create policy "staff update product bom assignments" on public.product_bom_assignments for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin delete product bom assignments" on public.product_bom_assignments for delete using (public.is_admin());

create policy "authenticated read packing templates" on public.packing_templates for select using (auth.role() = 'authenticated');
create policy "staff write packing templates" on public.packing_templates for insert with check (auth.role() = 'authenticated');
create policy "staff update packing templates" on public.packing_templates for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin delete packing templates" on public.packing_templates for delete using (public.is_admin());

create policy "authenticated read packing template lines" on public.packing_template_lines for select using (auth.role() = 'authenticated');
create policy "staff write packing template lines" on public.packing_template_lines for insert with check (auth.role() = 'authenticated');
create policy "staff update packing template lines" on public.packing_template_lines for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin delete packing template lines" on public.packing_template_lines for delete using (public.is_admin());

create policy "authenticated read quick orders" on public.quick_orders for select using (auth.role() = 'authenticated');
create policy "staff write quick orders" on public.quick_orders for insert with check (auth.role() = 'authenticated');
create policy "staff update quick orders" on public.quick_orders for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin delete quick orders" on public.quick_orders for delete using (public.is_admin());

create policy "authenticated read quick order lines" on public.quick_order_lines for select using (auth.role() = 'authenticated');
create policy "staff write quick order lines" on public.quick_order_lines for insert with check (auth.role() = 'authenticated');
create policy "staff update quick order lines" on public.quick_order_lines for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin delete quick order lines" on public.quick_order_lines for delete using (public.is_admin());

create policy "authenticated read quick order packing groups" on public.quick_order_packing_groups for select using (auth.role() = 'authenticated');
create policy "staff write quick order packing groups" on public.quick_order_packing_groups for insert with check (auth.role() = 'authenticated');
create policy "staff update quick order packing groups" on public.quick_order_packing_groups for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin delete quick order packing groups" on public.quick_order_packing_groups for delete using (public.is_admin());

create policy "authenticated read quick order materials" on public.quick_order_materials for select using (auth.role() = 'authenticated');
create policy "staff write quick order materials" on public.quick_order_materials for insert with check (auth.role() = 'authenticated');
create policy "staff update quick order materials" on public.quick_order_materials for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin delete quick order materials" on public.quick_order_materials for delete using (public.is_admin());

create policy "authenticated read quick order logs" on public.quick_order_logs for select using (auth.role() = 'authenticated');
create policy "staff write quick order logs" on public.quick_order_logs for insert with check (auth.role() = 'authenticated');
create policy "staff update quick order logs" on public.quick_order_logs for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin delete quick order logs" on public.quick_order_logs for delete using (public.is_admin());
