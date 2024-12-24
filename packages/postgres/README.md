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

To start using the `PostgresMessagePickupRepository`, initialize it with an agent and a callback function for retrieving connection information.

Note that in this example, notification token is stored as a tag in connection records, so it is used to determine whether to create a Push notification callback or not for a given DIDComm connection.

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

### Using with a Credo-based DIDComm Mediator

This full example shows how `PostgresMessagePickupRepository` is created an initialized alongside an `Agent` instance:

```javascript
import { Agent, MediatorModule, MessagePickupModule } from '@credo-ts/core'
import { agentDependencies } from '@credo-ts/node'
import { MessageForwardingStrategy } from '@credo-ts/core/build/modules/routing/MessageForwardingStrategy'
import { PostgresMessagePickupRepository } from './PostgresMessagePickupRepository'

const messagePickupRepository = new PostgresMessagePickupRepository({
  postgresHost: 'postgres',
  postgresUser: 'user',
  postgresPassword: 'pass',
})
const agent = new Agent({
  dependencies: agentDependencies,
  config: { label: 'Test' },
  modules: {
    mediator: new MediatorModule({ messageForwardingStrategy: MessageForwardingStrategy.QueueOnly }),
    messagePickup: new MessagePickupModule({
      messagePickupRepository,
    }),
  },
})

const notificationSender = // { your implementation of a Push notification service }
const connectionInfoCallback = async (connectionId: string) => {
  const connectionRecord = await agent.connections.findById(connectionId)

  const token = connectionRecord?.getTag('device_token') as string | null

  return {
    sendPushNotification: token
      ? (messageId: string) => {
          notificationSender.send(token, messageId)
        }
      : undefined,
  }
}

await messagePickupRepository.initialize({ agent, connectionInfoCallback })
await agent.initialize()
```

With these steps, you can now use the `PostgresMessagePickupRepository` with your Credo-based DIDComm mediator. Have fun!
