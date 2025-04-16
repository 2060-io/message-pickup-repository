import fs from 'fs'
import path from 'path'

/**
 * Bootstrap initial migration files using actual SQL definitions from v1 and v2 schema.
 * Output: src/migrations/001-initial-schema.sql and 002-schema-upgrade.sql
 */

function setupMigrations() {
  const migrationsDir = path.resolve(__dirname, '../migrations')

  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true })
    console.info(`📁 Created migrations directory: ${migrationsDir}`)
  } else {
    console.info(`✅ Migrations directory already exists: ${migrationsDir}`)
  }

  const files: { name: string; content: string }[] = [
    {
      name: '001-initial-schema.sql',
      content: `
-- Create initial tables

CREATE TABLE IF NOT EXISTS queuedmessage (
  id VARCHAR(20) DEFAULT substr(md5(random()::text), 1, 20) PRIMARY KEY,
  connectionId VARCHAR(255),
  recipientKeys TEXT[],
  encryptedMessage JSONB,
  state VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS queuedmessage_connectionId_index ON queuedmessage (connectionId);

CREATE TABLE IF NOT EXISTS livesession (
  sessionid VARCHAR(255) PRIMARY KEY,
  connectionid VARCHAR(50),
  protocolVersion VARCHAR(50),
  role VARCHAR(50),
  instance VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS livesession_connectionid ON livesession USING btree (connectionid);
      `.trim(),
    },
    {
      name: '002-schema-upgrade.sql',
      content: `
-- Create new type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_state') THEN
    CREATE TYPE message_state AS ENUM ('pending', 'sending');
  END IF;
END$$;

-- Create new tables with updated schema

CREATE TABLE IF NOT EXISTS queued_message (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id VARCHAR(255),
  recipient_dids TEXT[],
  encrypted_message JSONB,
  state message_state NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS queued_message_connection_id_idx ON queued_message (connection_id);

CREATE TABLE IF NOT EXISTS live_session (
  session_id VARCHAR(255) PRIMARY KEY,
  connection_id VARCHAR(50),
  protocol_version VARCHAR(50),
  instance VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS live_session_connection_id_idx ON live_session USING btree (connection_id);

-- Migrate data from old tables into new ones

INSERT INTO queued_message (id, connection_id, recipient_dids, encrypted_message, state, created_at)
SELECT
  gen_random_uuid(),
  connectionId,
  recipientKeys,
  encryptedMessage,
  'pending',
  created_at
FROM queuedmessage;

INSERT INTO live_session (session_id, connection_id, protocol_version, instance, created_at)
SELECT
  sessionid,
  connectionid,
  protocolVersion,
  instance,
  created_at
FROM livesession;
      `.trim(),
    },
  ]

  for (const file of files) {
    const filePath = path.join(migrationsDir, file.name)

    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, file.content, 'utf-8')
      console.info(`✅ Created migration file: ${file.name}`)
    } else {
      console.warn(`⚠️  Skipped existing file: ${file.name}`)
    }
  }
}

try {
  setupMigrations()
  console.info('✅ Migration setup complete.')
  process.exit(0)
} catch (err) {
  console.error('❌ Failed to set up migrations:', (err as Error).message)
  process.exit(1)
}
