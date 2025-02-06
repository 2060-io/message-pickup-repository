import { QueuedMessage } from '@credo-ts/core'

export interface JsonRpcParams {
  connectionId: string
  messages: QueuedMessage[]
  id: string
}

export interface JsonRpcResponseSubscriber {
  jsonrpc: '2.0'
  method: 'messagesReceived'
  params: JsonRpcParams
}
