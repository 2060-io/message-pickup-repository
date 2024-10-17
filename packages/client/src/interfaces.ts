export interface JsonRpcParamsMessage {
  connectionId: string
  message: string
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
