export enum MessageState {
  pending = 'pending',
  sending = 'sending',
}

export const WS_PORT = Number(process.env.WS_PORT || 3100)

//MessageRepository Module

export const WS_URL_CONNECT = process.env.WS_URL_CONNECT || 'ws://localhost:3100/'
export const WS_USER = process.env.WS_USER
export const WS_PASSWORD = process.env.WS_PASSWORD
export const WS_RETRY_COUNT = 3
export const WS_RETRY_DELAY = 5000
export const WS_TIMEOUT = 10000
export const AGENT_PORT = 4000
