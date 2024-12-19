import { Logger } from '@credo-ts/core'

export interface ConnectionInfo {
  sendPushNotification?: (messageId: string) => Promise<void>
}

export interface PostgresMessagePickupRepositoryConfig {
  logger?: Logger
  postgresUser: string
  postgresPassword: string
  postgressHost: string
  postgresDatabaseName?: string
  fcmServiceBaseUrl?: string
}
