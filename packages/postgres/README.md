# credo-ts-message-pickup-repository-pg API Usage Documentation

## Overview

The `PostgresMessagePickupRepository` implements the MessagePickupRepository interface from @credo-ts to manage messaging in live mode. It uses PostgreSQL as the storage backend for all messaging operations and introduces a publish/subscribe system to support multiple instances sharing the same database that need .

This approach centralizes all database operations for a DIDComm Mediator, simplifying its implementation and ensuring seamless scalability across multiple instances.

## Features

- Message storage and retrieval: Save and fetch messages from a PostgreSQL database.

- Pub/Sub integration: Notify other services of new messages using Pub/Sub channels.

- Live session management: Handle live sessions for efficient message delivery.

- Database initialization: Automatically set up the database structure required for message operations.

## Installation

To use this module, install package in your Didcomm Mediator App:

```bash
npm i @2060.io/credo-ts-message-pickup-repository-pg

```

## Usage

Instance `PostgresMessagePickupRepository` with requires explicit configuration defined in `PostgresMessagePickupRepositoryConfig` type through its constructor to set up the PostgreSQL connection and Logger. Ensure to provide the necessary database credentials when creating an instance of the repository.

### Example Configuration

```javascript
const messageRepository = new PostgresMessagePickupRepository({
  logger: yourLoggerInstance,
  postgresUser: 'your_postgres_user',
  postgresPassword: 'your_postgres_password',
  postgresHost: 'your_postgres_host',
  postgresDatabaseName: 'your_database_name',
})
```

### Initializing the Repository

To start using the PostgresMessagePickupRepository, initialize it with an agent and a callback function for retrieving connection information.

```javascript
const connectionInfoCallback = async (connectionId) => {
          const connectionRecord = await this.agent.connections.findById(connectionId)
          const token = connectionRecord?.getTag('device_token') as string | null
          return {
   sendPushNotification: token ? (messageId) => { this.notificationSender.send(token, messageId }: undefined,
 }
}
await messagePickupRepository.initialize({ agent, connectionInfoCallback })
```

### How to implement credo-ts-message-pickup-repository-pg in Didcomm Mediator

In this section, we will explain in detail how to integrate the PostgresMessagePickupRepository into the [2060.io/Didcomm-mediator](https://github.com/2060-io/didcomm-mediator) with the following steps:

1. Ensure that the PostgreSQL database definition parameters are defined in the CloudAgentOptions interface, into CloudAgent.ts file

```javascript
export interface CloudAgentOptions {
  config: InitConfig
  port: number
  did?: string
  enableHttp?: boolean
  enableWs?: boolean
  dependencies: AgentDependencies
  messagePickupRepositoryWebSocketUrl?: string
  messagePickupMaxReceiveBytes?: number
  // postgres variables
  postgresUser?: string
  postgresPassword?: string
  postgresHost?: string
  postgresDatabaseName?: string
}
```

2. Ensure that within the `run()` function in `index.ts`, when instantiating the `initCloudAgent` function, the connection attributes for the PostgreSQL database are included.

```javascript
async function run() {
  logger.info(`Cloud Agent started on port ${AGENT_PORT}`)
  try {
    await initCloudAgent({
      config: {
        label: AGENT_NAME,
        endpoints: AGENT_ENDPOINTS,
        walletConfig: {
          id: WALLET_NAME,
          key: WALLET_KEY,
          keyDerivationMethod: keyDerivationMethodMap[KEY_DERIVATION_METHOD ?? KeyDerivationMethod.Argon2IMod],
          storage: POSTGRES_HOST ? askarPostgresConfig : undefined,
        },
        autoUpdateStorageOnStartup: true,
        backupBeforeStorageUpdate: false,
        logger: new AgentLogger(AGENT_LOG_LEVEL),
      },
      did: AGENT_PUBLIC_DID,
      port: AGENT_PORT,
      enableWs: WS_SUPPORT,
      enableHttp: HTTP_SUPPORT,
      dependencies: agentDependencies,
      messagePickupRepositoryWebSocketUrl: MPR_WS_URL,
      messagePickupMaxReceiveBytes: MPR_MAX_RECEIVE_BYTES,
      // postgres variables
      postgresUser: POSTGRES_USER,
      postgresPassword: POSTGRES_PASSWORD,
      postgresHost: POSTGRES_HOST,
      postgresDatabaseName: POSTGRES_DATABASE_NAME,
    })
  } catch (error) {
    logger.error(`${error}`)
    process.exit(1)
  }

  logger.info(`Cloud Agent initialized OK`)
}
```

3. Configure the `PostgresMessagePickupRepository` during the initialization of the Didcomm Mediator in the `initCloudAgent.ts` file as follows:

```javascript

import { MessagePickupRepositoryClient } from '@2060.io/credo-ts-message-pickup-repository-pg'
import { ConnectionInfo } from '@2060.io/credo-ts-message-pickup-repository-pg/build/interfaces'

export const initCloudAgent = async (config: CloudAgentOptions) => {
  const logger = config.config.logger ?? new ConsoleLogger(LogLevel.off)
  const publicDid = config.did

 const messageRepository = config.postgresHost
    ? PostgresMessagePickupRepository({
        logger: logger,
        postgresUser: config.postgresUser,
        postgresPassword: config.postgresPassword,
        postgresHost: config.postgresHost,
      })
    : new InMemoryMessagePickupRepository(new LocalFcmNotificationSender(logger), logger)

  if (!config.enableHttp && !config.enableWs) {
    throw new Error('No transport has been enabled. Set at least one of HTTP and WS')
  }

  const agent = createCloudAgent(config, messageRepository)

  if (messageRepository instanceof PostgresMessagePickupRepository) {

  // Define callback to retrieve ConnectionInfo if you need
  const connectionInfoCallback = async (connectionId) => {
          const connectionRecord = await this.agent.connections.findById(connectionId)
          const token = connectionRecord?.getTag('device_token') as string | null
          return {
   sendPushNotification: token ? (messageId) => { this.notificationSender.send(token, messageId) }: undefined,
    }
  }
  // Initalize
  await messageRepository.initialize({ agent, connectionInfoCallback })

  } else if (messageRepository instanceof InMemoryMessagePickupRepository) {
    messageRepository.setAgent(agent)
  }

  // The rest of the code ...
}
```

With these steps, you can now use the PostgresMessagePickupRepository integrated into a Didcomm Mediator. Have fun!
