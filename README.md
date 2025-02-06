# Message Pickup Repository implementations for Credo-based DIDComm agents

This monorepo contains different implementations of `MessagePickupRepository` interface for Credo agents, currently in use by [2060.io DIDComm Mediator]()

## Included apps and packages

### Postgres Message Pickup Repository for Credo TS

This is the simplest one: a fully featured implementation that supports Message Pickup V2 in a multi-instance environment and only requires a PostgreSQL database, which could be on the same host than Credo's wallet. Check out its documentation [here](./packages/postgres/README.md).

### WebSocket-based Message Pickup Repository client/server

A more advanced development where every Credo instance is connected through a WebSocket with a Message Pickup Repository Gateway that handles all the coordination between instances and aims to provide a better performance in large scale deployments where a big message throughput is required. Check documentation of both the [client](./packages/client) that must be injected into each Credo Mediator instance, and the [server](./apps/server) itself, for more details.