# Database migration workflow

The repository is the source of truth for database schema changes. Production
databases must only receive reviewed migrations that already pass a clean local
rebuild.

## ArchFlow daily workflow

1. Pull the latest branch and start the local database:

   ```bash
   git pull
   pnpm db:start
   ```

2. Create the migration file with the pinned project CLI. Never invent or edit
   the timestamp manually:

   ```bash
   pnpm exec supabase migration new add_descriptive_change
   ```

3. Write and review the SQL, including indexes, grants, RLS policies, and
   rollback or compatibility considerations.

4. Rebuild from an empty local database and lint the resulting schema:

   ```bash
   pnpm db:reset
   pnpm db:lint
   pnpm test
   ```

5. Commit the application code and migration in the same pull request. Never
   rename or edit a migration after it has been applied to a shared database.
   When a migration reaches the shared database, add its normalized checksum to
   `tests/migration-conventions.test.mjs` so CI protects that historical record.

6. Before a remote release, link the intended environment, compare migration
   history, preview the push, and then apply it:

   ```bash
   pnpm exec supabase link --project-ref <project-ref>
   pnpm exec supabase migration list --linked
   pnpm exec supabase db push --dry-run
   pnpm exec supabase db push
   ```

7. Run smoke tests and database advisors after deployment.

Never run `supabase db reset --linked` against production. Secrets, production
users, and personal data must not be committed as migrations or seed data.

## Starting a new Supabase project

For the imperative workflow used by ArchFlow, the first migration is the schema:

```bash
pnpm add -D -E supabase@<approved-version>
pnpm exec supabase init
pnpm exec supabase start
pnpm exec supabase migration new initial_schema
```

Define tables, constraints, indexes, triggers, grants, and RLS in the generated
SQL file, add non-sensitive development fixtures to `supabase/seed.sql`, and run
`pnpm exec supabase db reset --local` before the first remote deployment.

For teams that choose Supabase declarative schemas, define the desired state in
`supabase/schemas/*.sql` and generate migrations with
`supabase db diff -f <change-name>`. Do not mix declarative files with direct
local Studio changes as competing sources of truth.

## Starting a FastAPI/Postgres project without Supabase

Use PostgreSQL locally through Docker and manage schema history with Alembic:

```bash
alembic init migrations
alembic revision --autogenerate -m "create initial schema"
alembic upgrade head
```

Review generated migrations instead of trusting autogeneration blindly. CI must
create an empty PostgreSQL database and run `alembic upgrade head`. In staging
and production, run migrations once as a dedicated release job before rolling
out application instances; application replicas must not race to migrate the
same database at startup.
