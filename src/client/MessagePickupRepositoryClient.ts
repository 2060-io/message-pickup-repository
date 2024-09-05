import { Client } from 'rpc-websockets'
import { Logger } from '@nestjs/common'

export class MessagePickupRepositoryClient {
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
   * @param params - Parameters to pass to the 'takeFromQueue' method.
   * @returns {Promise<any>} - The result from the WebSocket server.
   */
  async takeFromQueue(params: any): Promise<any> {
    try {
      return await this.wsClient.call('takeFromQueue', params, 2000)
    } catch (error) {
      this.logger.error('Error calling takeFromQueue:', error)
      throw error
    }
  }

  /**
   * Call the 'getAvailableMessageCount' RPC method.
   * @param params - Parameters to pass to the 'getAvailableMessageCount' method.
   * @returns {Promise<number>} - The count of queued messages.
   */
  async getAvailableMessageCount(params: any): Promise<number | unknown> {
    try {
      const result = await this.wsClient.call('getAvailableMessageCount', params, 2000)

      return result
    } catch (error) {
      this.logger.error('Error calling getAvailableMessageCount:', error)
      throw error
    }
  }

  /**
   * Call the 'addMessage' RPC method.
   * @param params - Parameters to pass to the 'addMessage' method.
   * @returns {Promise<any>} - The result from the WebSocket server.
   */
  async addMessage(params: any): Promise<any> {
    try {
      return await this.wsClient.call('addMessage', params, 2000)
    } catch (error) {
      this.logger.error('Error calling addMessage:', error)
      throw error
    }
  }

  /**
   * Call the 'removeMessages' RPC method.
   * @param params - Parameters to pass to the 'removeMessages' method.
   * @returns {Promise<number>} - The number of removed messages.
   */
  async removeMessages(params: any): Promise<number | unknown> {
    try {
      return await this.wsClient.call('removeMessages', params, 2000)
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
  async getLiveSession(params: any): Promise<any> {
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
  async addLiveSession(params: any): Promise<any> {
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
  async removeLiveSession(params: any): Promise<any> {
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
