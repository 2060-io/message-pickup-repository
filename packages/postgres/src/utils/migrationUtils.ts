import { Pool } from 'pg'
import fs from 'fs'
import path from 'path'

/**
 * Runs all pending SQL migrations located in a specified folder.
 * Each migration file must follow the naming format: `NNN-name.sql` (e.g., `001-init.sql`).
 * The function uses a `schema_version` table to keep track of applied versions.
 * It automatically skips migrations that have already been applied.
 *
 * @param pool - PostgreSQL pool instance used to run the migration queries.
 * @param migrationsDir - Absolute path to the folder containing SQL migration files.
 *                        Defaults to `src/migrations/` relative to this file.
 * @throws Will throw an error if a migration fails to execute or the folder is unreadable.
 */
export async function runSqlMigrations(
  pool: Pool,
  migrationsDir: string = path.resolve(__dirname, 'migrations'),
): Promise<void> {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // Ensure the schema_version table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_version (
        id SERIAL PRIMARY KEY,
        version INTEGER NOT NULL,
        updated_at TIMESTAMP DEFAULT now()
      )
    `)

    // Get the current schema version
    const result = await client.query('SELECT version FROM schema_version ORDER BY id DESC LIMIT 1')
    const currentVersion = result.rows.length > 0 ? result.rows[0].version : 0
    console.info(`[migration] Current schema version: ${currentVersion}`)

    // Check if migrations directory exists
    if (!fs.existsSync(migrationsDir)) {
      console.warn(`[migration] Migrations directory not found: ${migrationsDir}. Skipping.`)
      await client.query('COMMIT')
      return
    }

    // Read and sort .sql files by version number
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => /^\d{3,}-[\w\-]+\.sql$/.test(file))
      .sort()

    for (const file of files) {
      const versionMatch = file.match(/^(\d{3,})-/)
      if (!versionMatch) {
        console.warn(`[migration] Skipping invalid filename: ${file}`)
        continue
      }

      const version = parseInt(versionMatch[1], 10)
      if (isNaN(version)) {
        console.warn(`[migration] Invalid version number in file: ${file}`)
        continue
      }

      if (version <= currentVersion) {
        console.debug(`[migration] Skipping already applied: ${file}`)
        continue
      }

      const filePath = path.join(migrationsDir, file)
      const sql = fs.readFileSync(filePath, 'utf-8')

      console.info(`[migration] Applying migration: ${file}`)

      try {
        await client.query(sql)
        await client.query(`INSERT INTO schema_version (version) VALUES ($1)`, [version])
        console.info(`[migration] Applied successfully: ${file}`)
      } catch (fileErr) {
        throw new Error(`[migration] Failed to apply ${file}: ${(fileErr as Error).message}`)
      }
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[migration] Migration process failed:', (err as Error).message)
    throw err
  } finally {
    client.release()
  }
}
