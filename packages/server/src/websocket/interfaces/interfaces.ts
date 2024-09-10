import { QueuedMessage } from '@credo-ts/core'

export interface RpcSendResponse {
  jsonrpc: string
  result: QueuedMessage[]
  id: string
}
