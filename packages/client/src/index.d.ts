import {
  JsonRpcParamsMessage,
  RemoveAllMessagesOptions,
  ConnectionIdOptions,
  AddLiveSessionOptions,
} from './interfaces'
import {
  QueuedMessage,
  AddMessageOptions,
  GetAvailableMessageCountOptions,
  RemoveMessagesOptions,
  TakeFromQueueOptions,
} from '@credo-ts/core'

declare module '@2060.io/message-pickup-repository-client' {
  export class MessagePickupRepositoryClient {
    constructor(url: string)

    connect(): Promise<void>
    disconnect(): Promise<void>

    messageReceived(callback: (data: JsonRpcParamsMessage) => void): void

    takeFromQueue(params: TakeFromQueueOptions): Promise<QueuedMessage[]>
    getAvailableMessageCount(params: GetAvailableMessageCountOptions): Promise<number>
    addMessage(params: AddMessageOptions): Promise<string | null>
    removeMessages(params: RemoveMessagesOptions): Promise<void>
    removeAllMessages(params: RemoveAllMessagesOptions): Promise<void>
    getLiveSession(params: ConnectionIdOptions): Promise<boolean | null>
    addLiveSession(params: AddLiveSessionOptions): Promise<boolean>
    removeLiveSession(params: ConnectionIdOptions): Promise<boolean>
    ping(): Promise<string | unknown>
  }
}
