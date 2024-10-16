import { QueuedMessage } from '@credo-ts/core'

export interface JsonRpcParamsMessage {
  connectionId: string
  message: QueuedMessage
  id?: string
}

export interface RemoveAllMessagesOptions {
  connectionId: string
  recipientDid: string
}

export interface ConnectionIdOptions {
  connectionId: string
}

export interface AddLiveSessionOptions {
  connectionId: string
  sessionId: string
}
