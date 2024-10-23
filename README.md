# Message Pickup Repository

## Description

Service designed for the management and storage of messaging for the Message Pickup repository of the credo-ts framework. It allows and facilitates the methods implemented by this module for handling messages from the mediator and its clients, adding live session management for clients, as well as a publish and subscribe notification process for clients connected on other instances when there is more than one mediation instance.

## Enviroments

## Environment Variables

| Variable               | Description                                                               | Default Value                                                     |
| ---------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `APP_PORT`             | The port number on which the application will run.                        | `3500`                                                            |
| `WS_PORT`              | The port number on which the WebSocket server runs.                       | `3100`                                                            |
| `FCM_SERVICE_BASE_URL` | The base URL for the push notification service.                           | _Not set by default_                                              |
| `MONGODB_URI`          | The MongoDB URI for connecting to the database.                           | `mongodb://user:password@localhost:27017/MessagePickupRepository` |
| `REDIS_TYPE`           | Allows set redis type works `single` or `cluster`                         | `single`                                                          |
| `REDIS_URL`            | The Redis database URL for connecting to the server.(only single mode)    | `redis://localhost:6379`                                          |
| `THRESHOLD_TIMESTAMP`  | Allows set threshold time to execute message persist module on milisecond | `60000`                                                           |

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

## Message Pickup Repository Documentation

For more information on how the server works, including details on WebSocket methods, pub/sub, and push notifications, check out the [Message Pickup Repository Server](./docs/message-pickup-repository-server.md).

## Message Pickup Repository Client Documentation

For detailed instructions on setting up a client, including typescript examples, check out the [Message Pickup Repository Client](./docs/message-pickup-repository-client.md).
