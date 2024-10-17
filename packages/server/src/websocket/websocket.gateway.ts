import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { WebsocketService } from './websocket.service'
import { Server } from 'rpc-websockets'
import { WS_PORT } from '../config/constants'
import {
  AddLiveSessionDto,
  AddMessageDto,
  ConnectionIdDto,
  RemoveAllMessagesDto,
  RemoveMessagesDto,
  TakeFromQueueDto,
} from './dto/messagerepository-websocket.dto'

@Injectable()
export class WebsocketGateway implements OnModuleInit, OnModuleDestroy {
  private server: Server
  private readonly logger: Logger

  constructor(private readonly websocketService: WebsocketService) {
    this.logger = new Logger(WebsocketGateway.name)
  }

  /**
   * Called when the module is initialized.
   * Initializes the WebSocket server, registers RPC methods, and sets up event listeners.
   *
   * @returns {Promise<void>}
   */
  async onModuleInit(): Promise<void> {
    try {
      this.logger.log('Initializing WebSocket server')
      this.initServer()
      this.listenersEvent()
      this.registerRpcMethods()
      this.websocketService.setServer(this.server)
    } catch (error) {
      this.logger.error('Failed to initialize WebSocket server', error.stack)
      throw new Error('WebSocket server initialization failed')
    }
  }

  /**
   * Called when the module is destroyed.
   * Closes the WebSocket server gracefully.
   */
  onModuleDestroy(): void {
    try {
      this.logger.log('Shutting down WebSocket server')
      this.server.close()
    } catch (error) {
      this.logger.error('Failed to shut down WebSocket server', error.stack)
    }
  }

  /**
   * Initializes the WebSocket server with specific configurations.
   * Sets up the server to listen on the specified port and defines a custom error.
   */
  private initServer(): void {
    try {
      this.server = new Server({
        port: WS_PORT,
      })

      this.server.event('messageReceive')
      this.server.createError(500, 'Error initializing WebSocket server', {
        jsonrpc: '2.0',
        result: 'error',
        id: 1,
      })
      this.logger.error(`WebSocket server listening on port ${WS_PORT}`)
    } catch (error) {
      this.logger.error('Error during WebSocket server initialization', error.stack)
      throw error
    }
  }

  /**
   * Registers JSON-RPC methods and maps them to corresponding service functions.
   * Handles potential errors during method execution.
   */
  private registerRpcMethods(): void {
    try {
      this.server.register('takeFromQueue', async (params) => {
        try {
          return await this.websocketService.takeFromQueue(params as TakeFromQueueDto)
        } catch (error) {
          this.logger.error('Error in takeFromQueue method', error.stack)
          throw this.server.createError(500, 'Internal server error', { details: error.message })
        }
      })

      this.server.register('getAvailableMessageCount', async (params) => {
        try {
          return await this.websocketService.getAvailableMessageCount(params as ConnectionIdDto)
        } catch (error) {
          this.logger.error('Error in getAvailableMessageCount method', error.stack)
          throw this.server.createError(500, 'Internal server error', { details: error.message })
        }
      })

      this.server.register('addMessage', async (params) => {
        try {
          const result = await this.websocketService.addMessage(params as AddMessageDto)
          return result
        } catch (error) {
          this.logger.log('Error in addMessage method', error.stack)
          throw this.server.createError(500, 'Internal server error', { details: error.message })
        }
      })

      this.server.register('removeMessages', async (params) => {
        try {
          await this.websocketService.removeMessages(params as RemoveMessagesDto)
          return true
        } catch (error) {
          this.logger.error('Error in removeMessages method', error.stack)
          throw this.server.createError(500, 'Internal server error', { details: error.message })
        }
      })

      this.server.register('removeAllMessages', async (params) => {
        try {
          await this.websocketService.removeAllMessage(params as RemoveAllMessagesDto)
          return true
        } catch (error) {
          this.logger.error('Error in removeAllMessages method', error.stack)
          throw this.server.createError(500, 'Internal server error', { details: error.message })
        }
      })

      this.server.register('getLiveSession', async (params) => {
        try {
          return await this.websocketService.getLiveSession(params as ConnectionIdDto)
        } catch (error) {
          this.logger.error('Error in getLiveSession method', error.stack)
          throw this.server.createError(500, 'Internal server error', { details: error.message })
        }
      })

      this.server.register('addLiveSession', async (params, socket_id: string) => {
        try {
          return await this.websocketService.addLiveSession(params as AddLiveSessionDto, socket_id)
        } catch (error) {
          this.logger.error('Error in addLiveSession method', error.stack)
          throw this.server.createError(500, 'Internal server error', { details: error.message })
        }
      })

      this.server.register('removeLiveSession', async (params) => {
        try {
          return await this.websocketService.removeLiveSession(params as ConnectionIdDto)
        } catch (error) {
          this.logger.error('Error in removeLiveSession method', error.stack)
          throw this.server.createError(500, 'Internal server error', { details: error.message })
        }
      })

      this.server.register('ping', async () => {
        this.logger.log(`Initialize test ping`)
        return 'pong'
      })
    } catch (error) {
      this.logger.error('Error during RPC method registration', error.stack)
      throw error
    }
  }

  /**
   * Sets up event listeners for WebSocket server events like connection, disconnection, and errors.
   */
  private listenersEvent(): void {
    try {
      this.server.on('connection', (request) => {
        this.logger.log(`Client connected  ${request}`)
      })

      this.server.on('disconnection', (request) => {
        this.logger.log(`Client disconnected: ${request}`)
      })

      this.server.on('error', (error) => {
        this.logger.error(`WebSocket server error: ${error}`)
      })

      this.server.on('socket-error', (error) => {
        this.logger.error(`WebSocket socket error: ${error}`)
      })
    } catch (error) {
      this.logger.error('Error setting up event listeners', error.stack)
      throw error
    }
  }
}
