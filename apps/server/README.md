# WebSocket-based Message Pickup Repository Server for Credo TS

## Description

Service designed for the management and storage of messaging for the Message Pickup repository of the credo-ts framework. It allows and facilitates the methods implemented by this module for handling messages from the mediator and its clients, adding live session management for clients, as well as a publish and subscribe notification process for clients connected on other instances when there is more than one mediation instance.

## Enviroments

## Environment Variables

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

## Installation

```bash
$ yarn install
```

## Running the app

```bash
# development
$ yarn run start

# watch mode
$ yarn run start:dev

# production mode
$ yarn run start:prod
```

## Test

```bash
# unit tests
$ yarn run test

# e2e tests
$ yarn run test:e2e

# test coverage
$ yarn run test:cov
```

# API Documentation

For more information on how the server works, including details on WebSocket methods, pub/sub, and push notifications, check out the [Message Pickup Repository Server API Documentation](./docs/api.md).
