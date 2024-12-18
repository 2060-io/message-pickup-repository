import { Logger } from '@credo-ts/core'

export interface ConnectionInfo {
  fcmNotificationToken?: string
  maxReceiveBytes?: number
}

export interface PostgresMessagePickupRepositoryConfig {
  logger?: Logger
  postgresUser: string
  postgresPassword: string
  postgressHost: string
  postgresNameDatabase?: string
  fcmServiceBaseUrl?: string
}
