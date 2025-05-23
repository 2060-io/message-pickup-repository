import { AddMessageOptions, QueuedMessage, TakeFromQueueOptions } from '@credo-ts/core'

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

export interface ExtendedTakeFromQueueOptions extends TakeFromQueueOptions {
  limitBytes?: number
}

export interface ExtendedAddMessageOptions extends AddMessageOptions {
  pushNotificationToken?: {
    type: string
    token?: string
  }
}

export interface ConnectionInfo {
  pushNotificationToken?: {
    type: string
    token?: string
  }
  maxReceiveBytes?: number
}
