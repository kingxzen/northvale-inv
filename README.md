# NORTHVALE INV

NORTHVALE INV is a private/internal beta for a focused manufacturing inventory and BOM planner MVP. It preserves the approved premium dark Stitch design system and keeps scope to Dashboard, Inventory, Production, Reports, BOM Library, Packing Templates, and Quick Order support.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-style local components
- Supabase Postgres persistence for safe modules
- React Hook Form
- Zod
- Recharts for simple reports

## Project Structure

```txt
src/app                  Routes and page shells
src/components/layout    Top bar and icon-only bottom navigation
src/components/ui        Owned shadcn/ui-style primitives
src/components/data      Inventory, production, status, and stat cards
src/components/forms     React Hook Form + Zod forms
src/components/reports   Recharts report widgets
src/data                 Demo/mock data kept behind safety guards
src/lib                  Supabase clients, validation, unit conversion, business rules
src/types                Domain types
supabase/migrations      Postgres schema, RLS policies, and completion function
.stitch                  Extracted Google Stitch reference export
```

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env.local
```

3. Fill in only the public browser-safe Supabase values:

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

4. Run locally:

```bash
npm run dev
```

5. Open `http://localhost:3003`.

## Supabase Setup

Apply the additive migrations in `supabase/migrations/0001_initial_schema.sql` and `supabase/migrations/0002_persistence_expansion.sql` through the Supabase SQL editor or CLI.

The schema includes:

- `profiles`
- `inventory_items`
- `products`
- `product_bom_lines`
- `production_jobs`
- `production_job_lines`
- `stock_transactions`
- `locations`
- `activity_logs`

Role behavior:

- Admin can manage all important records.
- Staff can add/edit inventory, create production plans, and create stock movements.
- Staff cannot permanently delete important records.

## Business Rules Included

- BOM quantities are batch-based.
- Draft and planned production jobs do not deduct inventory.
- Completion deducts raw materials and packaging.
- Completion adds finished goods.
- Stock movements write `stock_transactions`.
- Important actions write `activity_logs`.
- Manual adjustment requires a reason.
- Unit cost is optional.
- Missing cost produces a warning but does not block production.
- Supported conversions: `ml/liter`, `g/kg`, `gallon/liter`, and `pcs` to `pcs`.
- Grams are never automatically converted to milliliters.

## Current Data Mode

Private beta data mode:

- Inventory: Supabase
- BOM Library: Supabase
- Packing Templates: Supabase
- Production Plans: local/backup-based
- Quick Orders: local/backup-based
- Stock Transactions: local/backup-based
- Activity Logs: local/backup-based
- Analytics source data: mixed, with local/backup-based modules still included

Before every update or deploy, use `Reports -> Backup & Export -> Download Full Backup`. Do not run reset, seed, drop, truncate, delete-all, or `localStorage.clear` on production data.

## Vercel Environment Variables

Add these in Vercel project settings:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Do not add service-role keys or database passwords to the browser app.
