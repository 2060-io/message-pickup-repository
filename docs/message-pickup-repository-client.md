# MessagePickupRepositoryClient API Usage Documentation

## Overview

The `MessagePickupRepositoryClient` is a client library designed to interact with the Message Pickup repository Server to manage messaging queues and liveSession data. This document provides detailed usage examples and method descriptions.

## Table of Contents

1. [Installation](#installation)
2. [Available Methods](#available-methods)
   - [connect()](#connect)
   - [messagesReceived()](#messagesReceived)
   - [takeFromQueue()](#takeFromQueue)
   - [getAvailableMessageCount()](#getAvailableMessageCount)
   - [addMessage()](#addMessage)
   - [removeMessages()](#removeMessages)
   - [removeAllMessages()](#removeAllMessages)
   - [getLiveSession()](#getLiveSession)
   - [addLiveSession()](#addLiveSession)
   - [removeLiveSession()](#removeLiveSession)
   - [ping()](#ping)
   - [disconnect()](#disconnect)
3. [Usage](#usage)

## Installation

To use this client, make sure you have the `rpc-websockets` and `@nestjs/common` packages installed.

```bash
npm install rpc-websockets @nestjs/common
```

## Available Methods

### `connect()`

Establishes a WebSocket connection to the server.

- **Returns**: `Promise<void>`

---

### `messagesReceived(callback)`

Registers a callback to handle `messagesReceived` events from the WebSocket server. This method will be primarily used to receive new messages that are published by the server.

- **Parameters**:

  - `callback`: A function that receives the `JsonRpcParamsMessage` containing:
    - `connectionId: string`: The connection ID.
    - `message: QueuedMessage[]`: Array of queued messages.

- **Returns**: `void`

---

### `takeFromQueue(params)`

Retrieves messages from the queue.

- **Parameters**: `TakeFromQueueOptions`

  - `connectionId: string`: ID of the connection.
  - `recipientDid?: string`: Optional DID of the recipient.
  - `limit?: number`: Optional limit on the number of messages.
  - `deleteMessages?: boolean`: Whether to delete the messages after retrieval.

- **Returns**: `Promise<QueuedMessage[]>`

---

### `getAvailableMessageCount(params)`

Retrieves the number of available messages in the queue.

- **Parameters**: `GetAvailableMessageCountOptions`

  - `connectionId: string`: ID of the connection.
  - `recipientDid?: string`: Optional DID to filter the message count.

- **Returns**: `Promise<number>`

---

### `addMessage(params)`

Adds a message to the message queue.

- **Parameters**: `AddMessageOptions`

  - `connectionId: string`: ID of the connection.
  - `recipientDids: string[]`: Array of recipient DIDs.
  - `payload: EncryptedMessage`: The encrypted message content.

- **Returns**: `Promise<string | null>`

---

### `removeMessages(params)`

Removes specific messages from the queue.

- **Parameters**: `RemoveMessagesOptions`

  - `connectionId: string`: ID of the connection.
  - `messageIds: string[]`: Array of message IDs to remove.

- **Returns**: `Promise<void>`

---

### `removeAllMessages(params)`

Removes all messages associated with a connection and recipient DID.

- **Parameters**: `RemoveAllMessagesOptions`

  - `connectionId: string`: ID of the connection.
  - `recipientDid: string`: DID of the recipient.

- **Returns**: `Promise<void>`

---

### `getLiveSession(params)`

Retrieves live session data.

- **Parameters**: `ConnectionIdOptions`

  - `connectionId: string`: ID of the connection.

- **Returns**: `Promise<boolean | null>`

---

### `addLiveSession(params)`

Adds a live session.

- **Parameters**: `AddLiveSessionOptions`

  - `connectionId: string`: ID of the connection.
  - `sessionId: string`: ID of the session.

- **Returns**: `Promise<boolean>`

---

### `removeLiveSession(params)`

Removes a live session.

- **Parameters**: `ConnectionIdOptions`

  - `connectionId: string`: ID of the connection.

- **Returns**: `Promise<boolean>`

---

### `ping()`

Sends a ping request to the server to check the connection.

- **Returns**: `Promise<string>`

---

### `disconnect()`

Disconnects from the WebSocket server.

- **Returns**: `Promise<void>`

## Usage

Here is a simple usage example:

```typescript
import { MessagePickupRepositoryClient } from '@2060.io/message-pickup-repository-client'

async function runClient() {
  const client = new MessagePickupRepositoryClient('ws://localhost:3500')

  try {
    // Connect to the WebSocket server
    await client.connect()
    console.log('Connected to the WebSocket server.')

    // Register message receive callback
    client.messagesReceived((data) => {
      console.log('Received message:', data)
    })

    // Add a message to the queue
    await client.addMessage({
      connectionId: 'test-connection',
      recipientDids: ['did:example:123'],
      payload: 'Encrypted message content',
    })

    // Get available message count
    const count = await client.getAvailableMessageCount({ connectionId: 'test-connection' })
    console.log('Available messages count:', count)

    // Retrieve messages from the queue
    const messages = await client.takeFromQueue({
      connectionId: 'test-connection',
      limit: 10,
      deleteMessages: true,
    })
    console.log('Retrieved messages:', messages)

    // Remove specific messages from the queue
    await client.removeMessages({
      connectionId: 'test-connection',
      messageIds: ['message-1', 'message-2'],
    })

    // Remove all messages for a connection and recipient
    await client.removeAllMessages({
      connectionId: 'test-connection',
      recipientDid: 'did:example:123',
    })

    // Get live session data
    const liveSession = await client.getLiveSession({ connectionId: 'test-connection' })
    console.log('Live session data:', liveSession)

    // Add a live session
    await client.addLiveSession({
      connectionId: 'test-connection',
      sessionId: 'live-session-id',
    })

    // Remove a live session
    await client.removeLiveSession({ connectionId: 'test-connection' })

    // Ping the server to check the connection
    const pong = await client.ping()
    console.log('Ping response:', pong)

    // Disconnect the client
    await client.disconnect()
    console.log('Disconnected from WebSocket server.')
  } catch (error) {
    console.error('An error occurred:', error)
  }
}

runClient()
```
