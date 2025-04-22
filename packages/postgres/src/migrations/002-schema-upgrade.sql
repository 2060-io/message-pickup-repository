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
  connection_id UUID,
  recipient_dids TEXT[],
  encrypted_message JSONB,
  state message_state NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS queued_message_connection_id_idx ON queued_message (connection_id);

CREATE INDEX IF NOT EXISTS queued_message_connection_id_state_idx ON queued_message (connection_id, state);

CREATE INDEX IF NOT EXISTS queued_message_created_at_idx ON queued_message (created_at);

CREATE TABLE IF NOT EXISTS live_session (
  session_id UUID PRIMARY KEY,
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
  connectionId::uuid,
  recipientKeys,
  encryptedMessage,
  'pending',
  created_at
FROM queuedmessage;

INSERT INTO live_session (session_id, connection_id, protocol_version, instance, created_at)
SELECT
  sessionid::uuid,
  connectionid,
  protocolVersion,
  instance,
  created_at
FROM livesession;

DROP TABLE IF EXISTS queuedmessage;

DROP TABLE IF EXISTS livesession;