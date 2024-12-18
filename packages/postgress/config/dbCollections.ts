export const messagesTableName = 'storequeuedMessage'

export const createTableMessage = `
CREATE TABLE IF NOT EXISTS ${messagesTableName} (
  id VARCHAR(20) DEFAULT substr(md5(random()::text), 1, 20) PRIMARY KEY,
  connectionId VARCHAR(255),
  recipientKeys TEXT[],
  encryptedMessage JSONB,
  state VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "${messagesTableName}_connectionId_index" ON "queuedmessages" (connectionId);
CREATE INDEX IF NOT EXISTS "${messagesTableName}_created_at_index" ON "queuedmessages" (created_at);
`

export const liveSessionTableName = 'storelivesession'

export const createTableLive = `
CREATE TABLE IF NOT EXISTS ${liveSessionTableName} (
  sessionid VARCHAR(255) PRIMARY KEY,
  connectionid VARCHAR(50),
  protocolVersion VARCHAR(50),
  role VARCHAR(50),
  instance VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "${liveSessionTableName}_connectionid" ON "${liveSessionTableName}" USING btree ("connectionid");`
