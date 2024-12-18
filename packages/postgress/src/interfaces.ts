import { Logger } from '@credo-ts/core'

export interface ConnectionInfo {
  sendPushNotification?: (messageId: string) => Promise<void>
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
