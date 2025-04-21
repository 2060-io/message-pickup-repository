# Database Build PostgreSQL SQL and Migrations

This guide explains how to manage and apply versioned `.sql` migrations used by the `PostgresMessagePickupRepository`.

## 📦 Overview

This system uses plain `.sql` files to track schema evolution over time. Each file:

- Has a version number prefix
- Is applied **once**
- Is tracked via a `schema_version` table
- Lives in the `migrations/` folder inside the package

The function `buildPgDatabaseWithMigrations()` will:

1. Create the target database if it doesn't exist.
2. Run all SQL files in `migrations/` in version order (e.g. `001-init.sql`, `002-add-index.sql`).
3. Insert each version into the `schema_version` table once applied.

## 📁 Directory Structure

```bash
migrations/
├── 001-initial-schema.sql
├── 002-upgrade-schema.sql
├── 003-add-index.sql
```

## ✅ Naming Convention

- Use **3-digit prefix** followed by a descriptive name, ending in `.sql`
- Example:
  - `001-initial-schema.sql`
  - `002-add-live-session-table.sql`
  - `003-create-indexes.sql`

The prefix determines execution order.

## 🛠 How to Add a New Migration

1. Create a new `.sql` file in `src/migrations/` (before build).
1. Name it using the next available version number (e.g. `004-add-new-column.sql`).
1. Place only **idempotent SQL** (i.e. can safely be re-run).

Example migration:

```sql
-- 004-add-received_at.sql
ALTER TABLE queued_message ADD COLUMN IF NOT EXISTS received_at TIMESTAMP;
```

1. Run `yarn build` to copy the file to `build/migrations/`.

## 🚀 How to Apply Migrations

Migrations are automatically applied when this function is called:

```ts
await buildPgDatabaseWithMigrations(
  {
    user: 'postgres',
    password: 'postgres',
    host: 'localhost',
  },
  'messagepickuprepository',
)
```

Or if used in the repository:

```ts
await messageRepository.initialize({ agent })
```

Make sure to set the environment variable:

```bash
ENABLE_DB_MIGRATIONS=true
```

## 🧪 Migration Tracking Table

A table called `schema_version` will be created automatically:

```sql
CREATE TABLE schema_version (
  id SERIAL PRIMARY KEY,
  version INTEGER NOT NULL,
  updated_at TIMESTAMP DEFAULT now()
);
```

Only migrations with a higher version number than the latest applied will run.

## 🧼 Best Practices

- Do **not** rename or reorder migration files after they've been applied.
- Do **not** delete old migration files unless you're resetting the database.
- Always test your `.sql` files locally before pushing them to production.
- Make sure each file is **atomic** (can succeed or fail independently).

## 🧩 Troubleshooting

- Missing folder at runtime? Ensure `migrations/` is copied to `build/` during `yarn build`
- Error running `.sql`? Validate syntax using `psql` or pgAdmin first
- Migration failed? Check the logs — execution will continue but the schema version won’t advance
