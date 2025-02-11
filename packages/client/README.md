# WebSocket-based MessagePickupRepository client

## Overview

`MessagePickupRepositoryClient` is a client library designed to interact with [Message Pickup repository Server](https://github.com/2060-io/message-pickup-repository/tree/main/apps/server) to manage messaging queues and Live Mode message pickup session data. 

## Table of Contents

- [WebSocket-based MessagePickupRepository client](#websocket-based-messagepickuprepository-client)
  - [Overview](#overview)
  - [Table of Contents](#table-of-contents)
  - [Installation](#installation)
  - [Usage](#usage)

## Installation

To use this client, simply install the package from npm:

```bash
npm install @2060.io/message-pickup-repository-client
```

## Usage

Setting up `MessagePickupRepositoryClient` is quite simple if you have some prior experience with Credo. We can summarize it in three steps: create, initialize and inject into a Credo instance.

First of all, you must construct an instance specifying MPR server URL:

```ts
  const messagePickupRepository = new MessagePickupRepositoryClient({url: 'ws://localhost:3500'})
```

Then, you need to register **callbacks** and connect to the server:

- **setConnectionInfo**: it is called by MPR client when it needs to get some specific DIDComm connection data. It is mostly needed to retrieve the Push notification token that MPR Gateway will use to notify offline clients
- **messagesReceived**: this callback informs that a message has been received for a client connected to this mediator instance. By using this callback, the instance can deliver the message immediately by using Credo's `MessagePickupApi.deliverMessages` method


```ts
    messagePickupRepository.setConnectionInfo(async (connectionId: string): Promise<ConnectionInfo | undefined> => {
      const connectionRecord = await agent.connections.findById(connectionId)
      return {
        fcmNotificationToken: connectionRecord?.getTag('device_token') as string | undefined,
        maxReceiveBytes: config.messagePickupMaxReceiveBytes,
      }
    })

    messagePickupRepository.messagesReceived(async (data) => {
      const { connectionId, messages } = data

      logger.debug(`[messagesReceived] init with ${connectionId} message to ${JSON.stringify(messages, null, 2)}`)

      const liveSession = await agent.messagePickup.getLiveModeSession({ connectionId })

      if (liveSession) {
        logger.debug(`[messageReceived] found LiveSession for connectionId ${connectionId}, Delivering Messages`)

        await agent.messagePickup.deliverMessages({
          pickupSessionId: liveSession.id,
          messages,
        })
      } else {
        logger.debug(`[messagesReceived] not found LiveSession for connectionId ${connectionId}`)
      }
    })

    await messagePickupRepository.connect()

```

Finally, inject the `MessagePickupRepositoryClient` and initialize the `Agent`:

```ts

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

await agent.initilize()
```
