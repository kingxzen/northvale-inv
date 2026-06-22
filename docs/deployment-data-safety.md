# NORTHVALE INV Deployment Data Safety

Before deploying feature updates:

- Export/backup production data first.
- Do not run reset, truncate, drop, deleteMany, or clear-storage commands in production.
- Do not run seed/import automatically during app load, build, or deploy.
- Use additive migrations whenever possible.
- Seed/import must be manual, idempotent, and must never reset stock quantity, cost, BOMs, production plans, quick orders, transactions, or logs unless explicitly requested.

Mock data is demo-only. Enable it only with `NEXT_PUBLIC_ENABLE_DEMO_DATA=true` in a disposable demo environment.
