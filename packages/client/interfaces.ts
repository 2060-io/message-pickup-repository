import { QueuedMessage } from '@credo-ts/core'

export interface JsonRpcParamsMessage {
  connectionId: string
  message: QueuedMessage[]
  id?: string
}
