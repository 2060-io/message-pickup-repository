import { QueuedMessage } from '@credo-ts/core'

export interface JsonRpcParams {
  connectionId: string
  message: QueuedMessage[]
  id: string
}

export interface JsonRpcResponseSubscriber {
  jsonrpc: '2.0'
  method: 'messageReceive'
  params: JsonRpcParams
}
