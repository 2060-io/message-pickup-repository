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