export const tableNameMessage = 'storequeuedmessage'

export const createTableMessage = `
CREATE TABLE IF NOT EXISTS ${tableNameMessage} (
  id VARCHAR(20) DEFAULT substr(md5(random()::text), 1, 20) PRIMARY KEY,
  connectionId VARCHAR(255),
  recipientKeys TEXT[],
  encryptedMessage JSONB,
  state VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "${tableNameMessage}_connectionId_index" ON "queuedmessages" (connectionId);
CREATE INDEX IF NOT EXISTS "${tableNameMessage}_created_at_index" ON "queuedmessages" (created_at);
`

export const tableNameLive = 'storelivesession'

export const createTableLive = `
CREATE TABLE IF NOT EXISTS ${tableNameLive} (
  sessionid VARCHAR(255) PRIMARY KEY,
  connectionid VARCHAR(50),
  instance VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "${tableNameLive}_connectionid" ON "${tableNameLive}" USING btree ("connectionid");`
