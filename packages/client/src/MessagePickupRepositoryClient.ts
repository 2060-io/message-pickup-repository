import { Client } from 'rpc-websockets'
import log from 'loglevel'
import {
  JsonRpcParamsMessage,
  RemoveAllMessagesOptions,
  ConnectionIdOptions,
  AddLiveSessionOptions,
} from './interfaces'
import {
  AddMessageOptions,
  GetAvailableMessageCountOptions,
  MessagePickupRepository,
  QueuedMessage,
  RemoveMessagesOptions,
  TakeFromQueueOptions,
} from '@credo-ts/core'

log.setLevel('info')

export class MessagePickupRepositoryClient implements MessagePickupRepository {
  private client?: Client
  private readonly logger = log
  private messageReceivedCallback: ((data: JsonRpcParamsMessage) => void) | null = null

  constructor(private readonly url: string) {}

  /**
   * Connect to the WebSocket server.
   * @returns {Promise<void>}
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client = new Client(this.url)

      const client = this.checkClient()

      client.on('open', () => {
        this.logger.log(`Connected to WebSocket server ${client}`)

        client.subscribe('messageReceive')

        client.addListener('messageReceive', (data) => {
          if (this.messageReceivedCallback) {
            this.messageReceivedCallback(data)
          } else {
            this.logger.log('Received message event, but no callback is registered:', data)
          }
        })

        resolve()
      })

      client.on('error', (error) => {
        this.logger.error('WebSocket connection error:', error)
        reject(error)
      })
    })
  }

  private checkClient(): Client {
    if (!this.client) {
      throw new Error('Client is not initialized. Call connect() first.')
    }
    return this.client
  }

  /**
   * Register a callback function for the 'messageReceive' event.
   * This function allows you to set up a listener for the 'messageReceive' event,
   * which is triggered when a message is received via JSON-RPC.
   *
   * @param callback - The callback function to be invoked when 'messageReceive' is triggered.
   * The callback receives a `data` parameter of type `JsonRpcParamsMessage`, containing:
   *
   * @param {JsonRpcParamsMessage} data - The data received via the 'messageReceive' event.
   *
   * @param {string} data.connectionId - The ID of the connection associated with the message.
   * @param {QueuedMessage[]} data.message - An array of queued messages received.
   * @param {string} [data.id] - (Optional) The identifier for the JSON-RPC message.
   *
   * @example
   * messageReceived((data: JsonRpcParamsMessage) => {
   *   console.log('ConnectionId:', data.connectionId);
   *   console.log('Messages:', data.message);
   * });
   */
  messageReceived(callback: (data: JsonRpcParamsMessage) => void): void {
    this.messageReceivedCallback = callback
  }

  /**
   * Call the 'takeFromQueue' RPC method.
   * This method sends a request to the WebSocket server to take messages from the queue.
   * It expects the response to be an array of `QueuedMessage` objects.
   *
   * @param {TakeFromQueueOptions} params - The parameters to pass to the 'takeFromQueue' method, including:
   *   @property {string} connectionId - The ID of the connection from which to take messages.
   *   @property {string} [recipientDid] - Optional DID of the recipient to filter messages by.
   *   @property {number} [limit] - Optional maximum number of messages to take from the queue.
   *   @property {boolean} [deleteMessages] - Optional flag indicating whether to delete the messages after retrieving them.
   * @returns {Promise<QueuedMessage[]>} - The result from the WebSocket server, expected to be an array of `QueuedMessage`.
   * @throws Will throw an error if the result is not an array or if there's any issue with the WebSocket call.
   */
  async takeFromQueue(params: TakeFromQueueOptions): Promise<QueuedMessage[]> {
    try {
      const client = this.checkClient()
      // Call the RPC method and store the result as 'unknown' type initially
      const result: unknown = await client.call('takeFromQueue', params, 2000)

      // Check if the result is an array and cast it to QueuedMessage[]
      if (Array.isArray(result)) {
        return result as QueuedMessage[]
      } else {
        throw new Error('Unexpected result: Expected an array of QueuedMessage objects')
      }
    } catch (error) {
      // Log the error and rethrow it for further handling
      this.logger.error('Error calling takeFromQueue:', error)
      throw error
    }
  }

  /**
   * Call the 'getAvailableMessageCount' RPC method.
   * This method sends a request to the WebSocket server to retrieve the number of queued messages.
   *
   * @param {GetAvailableMessageCountOptions} params - The parameters to pass to the 'getAvailableMessageCount' method, including:
   *   @property {string} connectionId - The ID of the connection for which to count the queued messages.
   *   @property {string} [recipientDid] - Optional DID of the recipient to filter the message count.
   * @returns {Promise<number>} - The count of queued messages.
   * @throws Will throw an error if the result is not a number or if there's any issue with the WebSocket call.
   */
  async getAvailableMessageCount(params: GetAvailableMessageCountOptions): Promise<number> {
    try {
      const client = this.checkClient()
      const result: unknown = await client.call('getAvailableMessageCount', params, 2000)

      if (typeof result === 'number') {
        return result
      } else {
        throw new Error('The result is not a number')
      }
    } catch (error) {
      this.logger.error('Error calling getAvailableMessageCount:', error)
      throw error
    }
  }

  /**
   * Call the 'addMessage' RPC method.
   * This method sends a request to the WebSocket server to add a message to the queue.
   * It expects the response to be a string or null.
   *
   * @param {AddMessageOptions} params - The parameters to pass to the 'addMessage' method, including:
   *   @property {string} connectionId - The ID of the connection to which the message will be added.
   *   @property {string[]} recipientDids - An array of DIDs of the recipients for whom the message is intended.
   *   @property {EncryptedMessage} payload - The encrypted message content to be queued.
   * @returns {Promise<string|null>} - The result from the WebSocket server, expected to be a string or null.
   * @throws Will throw an error if the result is not an object, null, or if there's any issue with the WebSocket call.
   */
  async addMessage(params: AddMessageOptions): Promise<string> {
    try {
      const client = this.checkClient()
      // Call the RPC method and store the result as 'unknown' type initially
      const result: unknown = await client.call('addMessage', params, 2000)

      this.logger.debug(`**** result: ${JSON.stringify(result, null, 2)} ***`)

      // Check if the result is a string and cast it
      if (result && typeof result === 'object') {
        return JSON.stringify(result)
      } else if (result === null) {
        return ''
      } else {
        throw new Error('Unexpected result: Expected an object or null')
      }
    } catch (error) {
      // Log the error and rethrow it for further handling
      this.logger.error('Error calling addMessage:', error)
      throw error
    }
  }

  /**
   * Call the 'removeMessages' RPC method.
   * This method sends a request to the WebSocket server to remove messages from the queue.
   *
   * @param {RemoveMessagesOptions} params - The parameters to pass to the 'removeMessages' method, including:
   *   @property {string} connectionId - The ID of the connection from which the messages will be removed.
   *   @property {string[]} messageIds - An array of message IDs to be removed.
   * @returns {Promise<void>} - Resolves to `void` upon successful removal.
   * @throws Will throw an error if the result is not a boolean or if there's any issue with the WebSocket call.
   */
  async removeMessages(params: RemoveMessagesOptions): Promise<void> {
    try {
      const client = this.checkClient()
      const result: unknown = await client.call('removeMessages', params, 2000)

      if (typeof result !== 'boolean') {
        throw new Error('Unexpected result: Expected an object or null')
      }
    } catch (error) {
      this.logger.error('Error calling removeMessages:', error)
      throw error
    }
  }

  /**
   * Call the 'removeAllMessages' RPC method.
   * @param params - Parameters to pass to the 'removeAllMessages' method.
   * @returns {Promise<void>}
   */
  async removeAllMessages(params: RemoveAllMessagesOptions): Promise<void> {
    try {
      const client = this.checkClient()
      const result: unknown = await client.call('removeAllMessages', params, 2000)

      if (typeof result !== 'boolean') {
        throw new Error('Unexpected result: Expected an object or null')
      }
    } catch (error) {
      this.logger.error('Error calling removeAllMessages:', error)
      throw error
    }
  }

  /**
   * Call the 'getLiveSession' RPC method.
   * This method retrieves the live session data from the WebSocket server.
   * It expects the response to be a boolean or null.
   *
   * @param {ConnectionIdOptions} params - The parameters to pass to the 'getLiveSession' method, including:
   *   @property {string} connectionId - The ID of the connection for which the live session is being retrieved.
   * @returns {Promise<boolean | null>} - The live session data. Returns `true` if the live session is active, or `null` if no session exists.
   * @throws Will throw an error if the result is not a boolean or null, or if there's any issue with the WebSocket call.
   */
  async getLiveSession(params: ConnectionIdOptions): Promise<boolean> {
    try {
      const client = this.checkClient()
      const result: unknown = await client.call('getLiveSession', params, 2000)

      // Check if the result is an object or null
      if (typeof result === 'boolean') {
        return result as boolean
      } else if (result === null) {
        return false
      } else {
        throw new Error('Unexpected result: Expected an object or null')
      }
    } catch (error) {
      this.logger.error('Error calling getLiveSession:', error)
      throw error
    }
  }

  /**
   * Call the 'addLiveSession' RPC method.
   * This method sends a request to the WebSocket server to add a live session.
   * It expects the response to be a boolean indicating success or failure.
   *
   * @param {AddLiveSessionOptions} params - The parameters to pass to the 'addLiveSession' method, including:
   *   @property {string} connectionId - The ID of the connection for which the live session is being added.
   *   @property {string} sessionId - The ID of the live session to be added.
   * @returns {Promise<boolean>} - The result from the WebSocket server, expected to be a boolean indicating success (`true`) or failure (`false`).
   * @throws Will throw an error if the result is not a boolean or if there's any issue with the WebSocket call.
   */
  async addLiveSession(params: AddLiveSessionOptions): Promise<boolean> {
    try {
      const client = this.checkClient()
      const result: unknown = await client.call('addLiveSession', params, 2000)

      // Check if the result is a boolean and return it
      if (typeof result === 'boolean') {
        return result
      } else {
        throw new Error('Unexpected result: Expected a boolean value')
      }
    } catch (error) {
      // Log the error and rethrow it for further handling
      this.logger.error('Error calling addLiveSession:', error)
      throw error
    }
  }

  /**
   * Call the 'removeLiveSession' RPC method.
   * This method sends a request to the WebSocket server to remove a live session.
   *
   * @param {ConnectionIdOptions} params - The parameters to pass to the 'removeLiveSession' method, including:
   *   @property {string} connectionId - The ID of the connection for which the live session will be removed.
   * @returns {Promise<boolean>} - The result from the WebSocket server, expected to be a boolean indicating success (`true`) or failure (`false`).
   * @throws Will throw an error if the result is not a boolean or if there's any issue with the WebSocket call.
   */
  async removeLiveSession(params: ConnectionIdOptions): Promise<boolean> {
    try {
      const client = this.checkClient()
      const result: unknown = await client.call('removeLiveSession', params, 2000)

      // Check if the result is a boolean and return it
      if (typeof result === 'boolean') {
        return result
      } else {
        throw new Error('Unexpected result: Expected a boolean value')
      }
    } catch (error) {
      this.logger.error('Error calling removeLiveSession:', error)
      throw error
    }
  }

  /**
   * Call the 'ping' RPC method to check the WebSocket connection.
   * This method sends a ping request to the WebSocket server and expects a 'pong' response.
   *
   * @returns {Promise<string>} - The 'pong' response from the WebSocket server.
   * @throws Will throw an error if there's any issue with the WebSocket call.
   */
  async ping(): Promise<string | unknown> {
    try {
      const client = this.checkClient()
      return await client.call('ping')
    } catch (error) {
      this.logger.error('Error calling ping:', error)
      throw error
    }
  }

  /**
   * Disconnects the WebSocket client.
   * @returns {Promise<void>}
   */
  async disconnect(): Promise<void> {
    const client = this.checkClient()
    client.close()
    this.logger.log('WebSocket client disconnected')
  }
}
