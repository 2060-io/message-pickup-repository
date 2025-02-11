# WebSocket-based Message Pickup Repository Server for Credo TS

## Overview

Message Pickup Repository (MPR) is a service designed to help on multi-instance, horizontally scalable mediators built on top of [Credo](https://github.com/openwallet-foundation/credo-ts). It proposes an efficient way of managing Message Pickup Live Mode sessions, allowing each mediator instance to be notified immediately when new messages for their connected clients.

It manages message storage when clients are not online, providing an interface to set up Push notifications, supporting both [FCM](https://firebase.google.com/docs/cloud-messaging) and [APN](https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns).

## Architecture

MPR consists of a Gateway that provides the API for its clients, a Redis cluster where messages are posted and a MongoDB database used to persist messages that were sent to offline users, for further retrieval when they are back.

![Architecture](./docs/diagrams/architecture.png)

In this diagram, Gateway englobes a component that is responsible for providing an API to the _MPR clients_ (which are usually Mediator instances) and maintaining WebSocket connections with them, querying and publishing into **Redis** and the **DB** queue according to the messages received from them.

**Redis** is intended to be a cache where all incoming Message Pickup messages are stored temporarily until they are picked up either by their corresponding recipient (this implies it has explicitly acknowledged its reception), or a timeout, where they are persisted into the **DB** for further retrieval when the recipient is online.

MPR also interacts with a _Push Notification Service_, responsible for notifying recipients who support Push notifications whenever a message is received while they are offline.

## API

MPR API consists mainly on messages to retrieve and add messages to pickup queue, and to add/remove Live Mode Message Pickup sessions in order to be notified when a DIDComm message for a given DIDComm recipient is received. 

The protocol is built on top of JSON-RPC 2.0 using WebSocket as transport. All methods match as much as possible (in terms of name and params) those of credo-ts' `MessagePickupRepository` interface, but adds some others used to handle sessions (subscriptions to Redis cache).

This API is fully implemented by [MPR Client](../../packages/client/README.md), a package meant to be plugged-in into Credo mediator instances.

For more information on how the server works, including details on WebSocket methods, pub/sub, and push notifications, check out the [Message Pickup Repository Server API Documentation](./docs/api.md).

## Example DIDComm mediator deployment using MPR

This deployment example shows how two mediator instances are dedicated to hold WebSocket connections with clients (_mediatees_). These instances subscribe to any incoming message received for each of their clients.

There is also another mediator instance that simply receives messages coming from external senders and publish them immediately into MPR Redis queue. Once a message is added to the queue for a given client, any mediator instance subscribed to client's new messages will pick it up and forward to it immediately.

Of course, it would be possible for each mediator instance to hold both roles if it suits best for the deployment model we want to follow.

![Deployment example](./docs/diagrams/deployment-example.png)

For more examples and diagrams to better understand how MPR works (and the motivation behind it), check out [these flows](./docs/flows.md).

## Set-up

### Environment Variables

Most of MPR configuration is done through environment variables.

| Variable                 | Description                                                                                                                                                                               | Default Value                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `APP_PORT`               | The port number on which the application will run.                                                                                                                                        | `3500`                                                            |
| `WS_PORT`                | The port number on which the WebSocket server runs.                                                                                                                                       | `3100`                                                            |
| `MONGODB_URI`            | The MongoDB URI for connecting to the database.                                                                                                                                           | `mongodb://user:password@localhost:27017/MessagePickupRepository` |
| `REDIS_TYPE`             | Allows set redis type works `single` or `cluster`                                                                                                                                         | `single`                                                          |
| `REDIS_NODES`            | A comma-separated list of Redis nodes' `host:port` for cluster mode. Only required if `REDIS_TYPE` is set to `cluster`. Ignored in single mode.                                           | `redis-node1:6379,redis-node2:6379,redis-node3:6379`              |
| `REDIS_NATMAP`           | The NAT mapping for Redis nodes in `externalAddress:host:port` format. Required for Redis cluster configurations where external IPs or ports are mapped to internal Redis node addresses. | `10.0.0.1:6379:redis-node1:6379,10.0.0.2:6379:redis-node2:6379`   |
| `REDIS_URL`              | The Redis database URL for connecting to the server.(only single mode)                                                                                                                    | `redis://localhost:6379`                                          |
| `THRESHOLD_TIMESTAMP`    | Allows set threshold time to execute message persist module on milisecond                                                                                                                 | `60000`                                                           |
| `FIREBASE_CFG_FILE`      | The file path to the Firebase configuration JSON file.                                                                                                                                    | `./test/firebase-cfg.json`                                        |
| `APNS_CFG_FILE`          | The file path to the APNs configuration JSON file.                                                                                                                                        | `./test/apns-cfg.json`                                            |
| `APNS_PATH_KEY`          | The file path to the APNs authentication key file.                                                                                                                                        | `./test/apns-authkey.p8`                                          |
| `APNS_TOPIC`             | The APNs topic, which is usually the app's bundle identifier.                                                                                                                             | `'default'`                                                       |
| `NOTIFICATION_DATA_ONLY` | Indicates whether notifications should be sent as data-only.                                                                                                                              | `false`                                                           |


### Running locally

In order to run it locally, you must install all dependencies by executing:

```bash
$ yarn install
```

You'll need to manually run your Redis and MongoDB, accessible to MPR. Then, run MPR in the appropriate mode:

```bash
# development
$ yarn run start

# watch mode
$ yarn run start:dev

# production mode
$ yarn run start:prod
```

Don't forget to set environment variables and configuration files as needed.

### Docker

To simplify set-up, it's recommended to use [published Docker images](https://hub.docker.com/r/io2060/message-pickup-repository).

See provided [Docker Compose YAML file](./docker-compose.yml) for an example of minimal set-up suitable for development and basic deployment.