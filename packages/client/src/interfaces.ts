import { QueuedMessage } from '@credo-ts/core'

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

export interface MessagesReceivedCallbackParams {
  connectionId: string
  messages: QueuedMessage[]
}
