# Message Pickup Repository Server API Documentation

## Overview

This documentation provides a detailed API Websocket guide for the **Message Pickup Repository Server**. This server manages message queues, live session tracking, and integrates WebSocket-based pub/sub mechanisms.

## Table of Contents

1. [Available Methods](#available-methods)

   - [takeFromQueue()](#takeFromQueue)
   - [getAvailableMessageCount()](#getAvailableMessageCount)
   - [addMessage()](#addMessage)
   - [removeMessages()](#removeMessages)
   - [removeAllMessages()](#removeAllMessages)
   - [getLiveSession()](#getLiveSession)
   - [addLiveSession()](#addLiveSession)
   - [removeLiveSession()](#removeLiveSession)

2. [Pub/Sub Instance Handler](#pubsub-instance-handler)
3. [Push Notifications Handler](#push-notifications-handler)

---

## Available Methods

### `takeFromQueue()`

Retrieves messages from the queue for a specific connection.

- **Parameters**:
  - `connectionId`: ID of the connection.
  - `recipientDid`: Optional DID of the recipient.
  - `limit`: Optional limit on the number of messages to retrieve.
  - `deleteMessages`: Optional flag to delete messages after retrieval.
- **Returns**: `QueuedMessage[]` (Array of messages)

### `getAvailableMessageCount()`

Retrieves the number of available messages in the queue for a given connection.

- **Parameters**:
  - `connectionId`: ID of the connection.
  - `recipientDid`: Optional DID of the recipient.
- **Returns**: `number` (Number of available messages)

### `addMessage()`

Adds a message to the queue for a specific connection.

- **Parameters**:
  - `connectionId`: ID of the connection.
  - `recipientDids`: Array of recipient DIDs.
  - `payload`: Encrypted message content.
- **Returns**: `string` (ID of the added message)

### `removeMessages()`

Removes specific messages from the queue for a given connection.

- **Parameters**:
  - `connectionId`: ID of the connection.
  - `messageIds`: Array of message IDs to remove.
- **Returns**: `void`

### `removeAllMessages()`

Removes all messages for a given connection and recipient DID.

- **Parameters**:
  - `connectionId`: ID of the connection.
  - `recipientDid`: DID of the recipient.
- **Returns**: `void`

### `getLiveSession()`

Retrieves live session data for a given connection.

- **Parameters**:
  - `connectionId`: ID of the connection.
- **Returns**: `boolean | null` (True if a live session exists, null otherwise)

### `addLiveSession()`

Adds a live session for a given connection.

- **Parameters**:
  - `connectionId`: ID of the connection.
  - `sessionId`: ID of the session to add.
- **Returns**: `boolean` (True if the session was successfully added)

### `removeLiveSession()`

Removes a live session for a given connection.

- **Parameters**:
  - `connectionId`: ID of the connection.
- **Returns**: `boolean` (True if the session was successfully removed)

---

### Pub/Sub Instance Handler

To resolve synchronization across multiple instances the Message Pickup Repository server implements a pub/sub mechanism using Redis cluster to notify clients in real-time about new messages for a specific `connectionId`.

#### 1. Publish (`publish`) via `addMessage()`

- When a new message is added to the queue, the `addMessage()` function publishes an event to the Redis channel associated with the `connectionId`. This notifies any subscribed clients that a new message is available.

#### 1. Subscription (`subscribe`) via `addLiveSession()`

- When the client connect with the server create a `addLiveSession()`, the server subscribes to the Redis channel associated - with the client’s `connectionId`. This allows the server to listen for new messages published for that connection.

- Then a new message is received, the server sends a JSON-RPC response to the client with the new message data.

- Once the server send JSON-RPC response, the client receives the notification with the message through its subscription to the `messagesReceived` event. The client’s callback function is triggered with the message data.

---

## Push Notifications Handler

In the **Message Pickup Repository**, the system ensures that clients are notified about new messages using **push notifications**. These notifications are sent using **Firebase Cloud Messaging (FCM)** for Android devices and **Apple Push Notification Service (APNs)** for iOS devices. This mechanism guarantees that clients receive alerts even if they are not in a live session with the server.

### When Are Push Notifications Triggered?

Push notifications are triggered under the following conditions:

1. **New Message Arrival**:  
   Whenever a new message is added to the message queue for a specific `connectionId`, the server determines if the client is online or not.

2. **Client Offline**:  
   If the client is not in a live session, a push notification is sent to notify the client of the new message:
   - **For Android devices**: The notification is sent via **FCM Notification Sender API**.
   - **For iOS devices**: The notification is sent via **APNs Notification Sender API**.

### How Does It Work?

1. **Message Queuing**:

   - When a new message is received, it is added to a queue in **Redis** for fast access and stored in **MongoDB** for persistence.
   - If the client is offline, the system initiates the push notification process.

2. **Notification Services**:

   - **FCM**: The `FcmNotificationSender` class handles the sending of notifications to Android devices.
   - **APNs**: The `ApnNotificationSender` class handles the sending of notifications to iOS devices.

3. **Token Management**:
   - The `PushNotificationQueueService` ensures that duplicate notifications are avoided by managing a queue of tokens.
