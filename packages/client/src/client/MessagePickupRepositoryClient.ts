import { Client } from 'rpc-websockets'
import { Logger } from '@nestjs/common'
import {
  AddMessageOptions,
  GetAvailableMessageCountOptions,
  MessagePickupRepository,
  QueuedMessage,
  RemoveMessagesOptions,
  TakeFromQueueOptions,
} from '@credo-ts/core'

import { AddLiveSessionDto, ConnectionIdDto } from '../dto/client.dto'

export class MessagePickupRepositoryClient implements MessagePickupRepository {
  private readonly wsClient: Client
  private readonly logger = new Logger(MessagePickupRepositoryClient.name)

  constructor(private readonly url: string) {
    this.wsClient = new Client(this.url)
  }

  /**
   * Connect to the WebSocket server.
   * @returns {Promise<void>}
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wsClient.on('open', () => {
        this.logger.log('Connected to WebSocket server')
        resolve()
      })

      this.wsClient.on('error', (error) => {
        this.logger.error('WebSocket connection error:', error)
        reject(error)
      })
    })
  }

  /**
   * Call the 'takeFromQueue' RPC method.
   * This method sends a request to the WebSocket server to take messages from the queue.
   * It expects the response to be an array of `QueuedMessage` objects.   *
   * @param params - Parameters to pass to the 'takeFromQueue' method.
   * @returns {Promise<QueuedMessage[]>} - The result from the WebSocket server, expected to be an array of `QueuedMessage`.
   * @throws Will throw an error if the result is not an array or if there's any issue with the WebSocket call.
   */
  async takeFromQueue(params: TakeFromQueueOptions): Promise<QueuedMessage[]> {
    try {
      // Call the RPC method and store the result as 'unknown' type initially
      const result: unknown = await this.wsClient.call('takeFromQueue', params, 2000)

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
   * @param params - Parameters to pass to the 'getAvailableMessageCount' method.
   * @returns {Promise<number>} - The count of queued messages.
   */
  async getAvailableMessageCount(params: GetAvailableMessageCountOptions): Promise<number> {
    try {
      const result: unknown = await this.wsClient.call('getAvailableMessageCount', params, 2000)

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
   * It expects the response to be a string.   *
   * @param params - Parameters to pass to the 'addMessage' method.
   * @returns {Promise<string>} - The result from the WebSocket server, expected to be a string.
   * @throws Will throw an error if the result is not a string or if there's any issue with the WebSocket call.
   */
  async addMessage(params: AddMessageOptions): Promise<string> {
    try {
      // Call the RPC method and store the result as 'unknown' type initially
      const result: unknown = await this.wsClient.call('addMessage', params, 2000)

      // Check if the result is a string and cast it
      if (typeof result === 'string') {
        return result
      } else {
        throw new Error('Unexpected result: Expected a string')
      }
    } catch (error) {
      // Log the error and rethrow it for further handling
      this.logger.error('Error calling addMessage:', error)
      throw error
    }
  }

  /**
   * Call the 'removeMessages' RPC method.
   * @param params - Parameters to pass to the 'removeMessages' method.
   * @returns {Promise<void>}
   */
  async removeMessages(params: RemoveMessagesOptions): Promise<void> {
    try {
      const result: unknown = await this.wsClient.call('removeMessages', params, 2000)

      // Si el resultado no es undefined o null, puedes lanzar un error (dependiendo de tu lógica)
      if (result !== undefined && result !== null) {
        throw new Error('Unexpected result for removeMessages')
      }
    } catch (error) {
      this.logger.error('Error calling removeMessages:', error)
      throw error
    }
  }

  /**
   * Call the 'getLiveSession' RPC method.
   * @param params - Parameters to pass to the 'getLiveSession' method.
   * @returns {Promise<any>} - The live session data.
   */
  async getLiveSession(params: ConnectionIdDto): Promise<any> {
    try {
      return await this.wsClient.call('getLiveSession', params, 2000)
    } catch (error) {
      this.logger.error('Error calling getLiveSession:', error)
      throw error
    }
  }

  /**
   * Call the 'addLiveSession' RPC method.
   * @param params - Parameters to pass to the 'addLiveSession' method.
   * @returns {Promise<any>} - The result from the WebSocket server.
   */
  async addLiveSession(params: AddLiveSessionDto): Promise<any> {
    try {
      return await this.wsClient.call('addLiveSession', params, 2000)
    } catch (error) {
      this.logger.error('Error calling addLiveSession:', error)
      throw error
    }
  }

  /**
   * Call the 'removeLiveSession' RPC method.
   * @param params - Parameters to pass to the 'removeLiveSession' method.
   * @returns {Promise<any>} - The result from the WebSocket server.
   */
  async removeLiveSession(params: ConnectionIdDto): Promise<any> {
    try {
      return await this.wsClient.call('removeLiveSession', params, 2000)
    } catch (error) {
      this.logger.error('Error calling removeLiveSession:', error)
      throw error
    }
  }

  /**
   * Call the 'ping' RPC method to check the connection.
   * @returns {Promise<string>} - 'pong' response from the server.
   */
  async ping(): Promise<string | unknown> {
    try {
      return await this.wsClient.call('ping')
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
    this.wsClient.close()
    this.logger.log('WebSocket client disconnected')
  }
}
