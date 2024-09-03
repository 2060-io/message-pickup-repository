import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { ConfigService, ConfigModule } from '@nestjs/config'
import { Model } from 'mongoose'
import { ObjectId } from 'mongodb'
import { Socket } from 'socket.io'
import { MessageState } from '../config/constants'
import {
  AddMessageDto,
  RemoveMessagesDto,
  TakeFromQueueDto,
  ConnectionIdDto,
  AddLiveSessionDto,
} from './dto/messagerepository-websocket.dto'
import { StoreLiveSession } from './schemas/StoreLiveSession'
import { QueuedMessage } from './schemas/QueuedMessage'
import { InstanceRegistration } from './schemas/InstanceRegistration'
import { InjectRedis } from '@nestjs-modules/ioredis'
import { lastValueFrom } from 'rxjs'
import { HttpService } from '@nestjs/axios'
import Redis from 'ioredis'

@Injectable()
export class WebsocketService {
  private readonly logger: Logger
  private readonly httpService: HttpService
  private readonly redisSubscriber: Redis
  private readonly redisPublisher: Redis

  constructor(
    @InjectModel(QueuedMessage.name) private queuedMessage: Model<QueuedMessage>,
    @InjectModel(StoreLiveSession.name) private storeLiveSession: Model<StoreLiveSession>,
    @InjectModel(InstanceRegistration.name) private instanceRegistration: Model<InstanceRegistration>,
    @InjectRedis() private readonly redis: Redis,
    private configService: ConfigService,
  ) {
    this.logger = new Logger(WebsocketService.name)
    this.redisSubscriber = this.redis.duplicate()
    this.redisPublisher = this.redis.duplicate()
  }

  async onModuleInit() {
    try {
      const pong = await this.redis.ping()
      this.logger.log(`Connected to Redis successfully, ping response: ${pong}`)
    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error.message)
    }
  }

  /**
   * Handles WebSocket requests by routing the request type to the appropriate method.
   *
   * @param {Object} message - The message object containing the request type and options.
   * @param {string} message.request - The type of request being made (e.g., 'takeFromQueue', 'addMessage').
   * @param {any} message.options - The options or parameters required by the specific request type.
   * @returns {Promise<any>} - Returns the result of the corresponding method or a warning if the command is unknown.
   */
  async wsRequest(message: { request: string; options: any }): Promise<any> {
    const { request, options } = message
    this.logger.log(`[wsRequest] message request: ${message.request} ***`)

    switch (request) {
      case 'takeFromQueue':
        // Handles the request to take messages from the queue
        return this.takeFromQueue(options)
      case 'getQueuedMessagesCount':
        // Handles the request to get the count of queued messages
        return this.getAvailableMessageCount(options)
      case 'addMessage':
        // Handles the request to add a message to the queue
        return this.addMessage(options)
      case 'removeMessages':
        // Handles the request to remove messages from the queue
        return this.removeMessages(options)
      case 'getLiveSession':
        // Handles the request to retrieve a live session
        return this.getLiveSession(options)
      case 'addLiveSession':
        // Handles the request to add a live session
        return this.addLiveSession(options)
      case 'removeLiveSession':
        // Handles the request to remove a live session
        return this.removeLiveSession(options)
      case 'ping':
        // Simple health check response
        return 'pong'
      default:
        // Logs a warning if the request type is unknown
        this.logger.warn(`Unknown command received: ${request}`)
        return `Unknown command: ${request}`
    }
  }

  /**
   * Retrieves messages from the queue based on the provided criteria.
   *
   * @param {TakeFromQueueDto} dto - Data transfer object containing the query parameters.
   * @param {string} dto.connectionId - The unique identifier of the connection.
   * @param {number} [dto.limit] - Optional limit on the number of messages to retrieve.
   * @param {boolean} [dto.deleteMessages] - Optional flag to determine if messages should be deleted after retrieval.
   * @param {string} [dto.recipientDid] - Optional recipient identifier for filtering messages.
   * @returns {Promise<QueuedMessage[]>} - A promise that resolves to an array of queued messages.
   */
  async takeFromQueue(dto: TakeFromQueueDto): Promise<QueuedMessage[]> {
    const { connectionId, limit, deleteMessages, recipientDid } = dto

    this.logger.debug('[takeFromQueue] Method called with DTO:', JSON.stringify(dto, null, 2))

    try {
      // Ensures the queuedMessage model is initialized before proceeding
      if (!this.queuedMessage) {
        throw new Error('[takeFromQueue] queuedMessage model is not initialized')
      }

      let messagesToUpdateIds: string[] = []

      // Fetches the messages based on connectionId or recipientDid, and in 'pending' state
      const storedMessages = await this.queuedMessage
        .find({
          $or: [{ connectionId }, { recipientKeys: recipientDid }],
          state: 'pending',
        })
        .sort({ createdAt: 1 }) // Sort messages by creation date (oldest first)
        .limit(limit ?? 0) // Limits the number of messages based on the provided limit
        .select({ _id: 1, state: 1, encryptedMessage: 1, createdAt: 1, receivedAt: '$createdAt' })
        .exec()

      // Extracts the message IDs for updating their state later
      messagesToUpdateIds = storedMessages.map((message) => message._id.toString())

      // If deleteMessages is not requested, update the state of the fetched messages to 'sending'
      if (!deleteMessages && messagesToUpdateIds.length > 0) {
        this.logger.debug('[takeFromQueue] Updating the state of messages to "sending"')
        await this.queuedMessage.updateMany({ _id: { $in: messagesToUpdateIds } }, { $set: { state: 'sending' } })
      }

      // Maps the stored messages to the QueuedMessage format, excluding the _id field
      const messages = storedMessages.map((message) => {
        const { _id, ...rest } = message
        return { id: _id.toString(), ...rest } as QueuedMessage
      })

      this.logger.debug('[takeFromQueue] Messages to return:', JSON.stringify(messages, null, 2))

      return messages
    } catch (error) {
      // Logs the error and returns an empty array if an exception occurs
      this.logger.error('[takeFromQueue] Error:', error)
      return []
    }
  }

  /**
   * Retrieves the count of available messages in the queue for a specific connection.
   *
   * @param {ConnectionIdDto} dto - Data transfer object containing the connection ID.
   * @param {string} dto.connectionId - The unique identifier of the connection.
   * @returns {Promise<number>} - A promise that resolves to the number of available messages.
   */
  async getAvailableMessageCount(dto: ConnectionIdDto): Promise<number> {
    this.logger.debug('[getAvailableMessageCount] Initializing method', { dto })
    const { connectionId } = dto

    // Ensures the queuedMessage model is initialized before proceeding
    if (!this.queuedMessage) {
      this.logger.error('[getAvailableMessageCount] queuedMessage model is not initialized')
      throw new Error('[getAvailableMessageCount] queuedMessage model is not initialized')
    }

    try {
      // Retrieves the count of messages in the queue for the specified connection ID
      const messageCount = await this.queuedMessage.countDocuments({ connectionId })

      this.logger.debug('[getAvailableMessageCount] Message count retrieved', {
        connectionId,
        messageCount,
      })

      return messageCount
    } catch (error) {
      // Logs the error and returns 0 if an exception occurs
      this.logger.error('[getAvailableMessageCount] Error retrieving message count', {
        connectionId,
        error: error.message,
      })
      return 0
    }
  }

  /**
   * Adds a new message to the queue and optionally sends a push notification or publishes a message to Redis.
   *
   * @param {AddMessageDto} dto - Data transfer object containing the message details.
   * @param {string} dto.connectionId - The unique identifier of the connection.
   * @param {string[]} dto.recipientDids - Array of recipient DIDs (Decentralized Identifiers).
   * @param {EncryptedMessage} dto.payload - The encrypted message payload to be queued.
   * @param {any} [dto.liveSession] - Optional live session object, if the message is part of a live session.
   * @param {string} [dto.token] - Optional token for sending push notifications.
   * @returns {Promise<{ messageId: string; receivedAt: Date } | undefined>} - A promise that resolves to the message ID and received timestamp or undefined if an error occurs.
   */
  async addMessage(dto: AddMessageDto): Promise<{ messageId: string; receivedAt: Date } | undefined> {
    // Ensures the queuedMessage model is initialized before proceeding
    if (!this.queuedMessage) {
      throw new Error('[addMessage] messagesCollection is not initialized')
    }

    const { connectionId, recipientDids, payload, liveSession, token } = dto
    let messageId: string
    let receivedAt: Date

    try {
      // Adds the new message to the queue with initial state depending on whether it's part of a live session
      const result = await this.queuedMessage.create({
        connectionId: connectionId,
        recipientKeys: recipientDids,
        encryptedMessage: payload,
        state: liveSession ? MessageState.sending : MessageState.pending,
      })

      // Validates that the result contains a valid ObjectId and extracts the timestamp
      if (result._id instanceof ObjectId) {
        messageId = result._id.toString()
        receivedAt = result._id.getTimestamp()
      } else {
        throw new Error('[addMessage] Unexpected _id type')
      }

      // If the message is part of a live session or the connection has a live session, publish a message to Redis
      if (liveSession || (await this.getLiveSession(dto))) {
        await this.redisPublisher.publish(connectionId, 'new message')
      } else {
        // If not in a live session, log and potentially send a push notification
        this.logger.debug(`[addMessage] connectionId not found in other instance`)
        this.logger.debug(`[addMessage] Push notification parameters token: ${token}; MessageId: ${messageId}`)

        if (token && messageId) {
          await this.sendPushNotification(token, messageId)
        }
      }

      this.logger.debug(
        `[addMessage] Added message for ${connectionId} with result ${messageId} and receivedAt ${receivedAt}`,
      )

      return { messageId, receivedAt }
    } catch (error) {
      // Logs the error and returns undefined if an exception occurs
      this.logger.debug(`[addMessage] Error adding message to queue: ${error}`)
      return undefined
    }
  }

  /**
   * Removes messages from the queue based on the provided connection ID and message IDs.
   *
   * @param {RemoveMessagesDto} dto - Data transfer object containing the connection ID and message IDs to be removed.
   * @param {string} dto.connectionId - The unique identifier of the connection.
   * @param {string[]} dto.messageIds - Array of message IDs to be removed from the queue.
   * @returns {Promise<number>} - A promise that resolves to the number of deleted messages, or -1 if an error occurs.
   */
  async removeMessages(dto: RemoveMessagesDto): Promise<number> {
    const { connectionId, messageIds } = dto

    this.logger.debug('[removeMessages] Method called with DTO:', dto)

    try {
      // Deletes messages from the queue matching the provided connection ID and message IDs
      const response = await this.queuedMessage.deleteMany({
        connectionId: connectionId,
        _id: { $in: messageIds.map((id) => new Object(id)) },
      })

      this.logger.debug('[removeMessages] Messages removed', {
        connectionId,
        messageIds,
        deletedCount: response.deletedCount,
      })

      return response.deletedCount
    } catch (error) {
      // Logs the error and returns -1 if an exception occurs
      this.logger.error('[removeMessages] Error removing messages', {
        connectionId,
        messageIds,
        error: error.message,
      })
      return -1
    }
  }

  /**
   * Retrieves the live session associated with the given connection ID.
   *
   * @param {ConnectionIdDto} dto - Data transfer object containing the connection ID.
   * @param {string} dto.connectionId - The unique identifier of the connection.
   * @returns {Promise<StoreLiveSession | null>} - A promise that resolves to the live session if found, or null if not found or an error occurs.
   */
  async getLiveSession(dto: ConnectionIdDto): Promise<StoreLiveSession | null> {
    const { connectionId } = dto

    this.logger.debug('[getLiveSession] Initializing find registry for connectionId', { connectionId })

    try {
      // Attempts to find the live session associated with the given connection ID
      const liveSession = await this.storeLiveSession.findOne({ connectionId })

      if (liveSession) {
        // If a live session is found, logs the event and publishes a 'new message' event to Redis
        this.logger.debug('[getLiveSession] Record found for connectionId', { connectionId })
        await this.redis.publish(connectionId, 'new message')
        return liveSession
      } else {
        // If no live session is found, logs the event and returns null
        this.logger.debug('[getLiveSession] No record found for connectionId', { connectionId })
        return null
      }
    } catch (error) {
      // Logs any errors encountered during the process and returns null
      this.logger.error('[getLiveSession] Error finding live session for connectionId', {
        connectionId,
        error: error.message,
      })
      return null
    }
  }

  /**
   * Adds a new live session to the database and subscribes to a Redis channel for the connection ID.
   *
   * @param {AddLiveSessionDto} dto - Data transfer object containing the live session details.
   * @param {string} dto.connectionId - The unique identifier of the connection.
   * @param {string} dto.sessionId - The session ID associated with the live session.
   * @param {string} dto.instance - The instance identifier where the session is active.
   * @returns {Promise<boolean>} - A promise that resolves to true if the live session is added successfully, or false if an error occurs.
   */
  async addLiveSession(dto: AddLiveSessionDto): Promise<boolean> {
    const { connectionId, sessionId, instance } = dto

    this.logger.debug('[addLiveSession] Initializing add LiveSession to DB', {
      connectionId,
      sessionId,
      instance,
    })

    try {
      // Attempts to create a new live session record in the database
      const response = await this.storeLiveSession.create({
        sessionId,
        connectionId,
        instance,
      })

      this.logger.debug('[addLiveSession] response:', { response })

      if (response) {
        this.logger.log('[addLiveSession] LiveSession added successfully', { connectionId })

        // Subscribes to the Redis channel for the connection ID
        await this.redisSubscriber.subscribe(connectionId, (err, count) => {
          if (err) this.logger.error(err.message)
          this.logger.log(`Subscribed to ${connectionId} channel.`)
        })

        // Handles messages received on the subscribed Redis channel
        this.redisSubscriber.on('message', (channel: string, message: string) => {
          if (channel === connectionId) {
            this.logger.log(`** Received message from ${channel}: ${message} **`)
            // TODO: Handle the new message for the connectionId
          }
        })
        return true
      } else {
        this.logger.error('[addLiveSession] Failed to add LiveSession', { connectionId })
        return false
      }
    } catch (error) {
      // Logs any errors encountered during the process and returns false
      this.logger.error('[addLiveSession] Error adding LiveSession to DB', {
        connectionId,
        error: error.message,
      })
      return false
    }
  }

  /**
   * Removes the live session associated with the given connection ID and unsubscribes from the Redis channel.
   *
   * @param {ConnectionIdDto} dto - Data transfer object containing the connection ID.
   * @param {string} dto.connectionId - The unique identifier of the connection.
   * @returns {Promise<boolean>} - A promise that resolves to true if the live session is removed successfully, or false if an error occurs or no session is found.
   */
  async removeLiveSession(dto: ConnectionIdDto): Promise<boolean> {
    const { connectionId } = dto

    this.logger.debug('[removeLiveSession] Initializing remove LiveSession', { connectionId })

    try {
      // Attempts to delete the live session(s) associated with the given connection ID
      const response = await this.storeLiveSession.deleteMany({ connectionId })

      this.logger.debug('[removeLiveSession] Delete response', { response })

      if (response.deletedCount > 0) {
        this.logger.debug('[removeLiveSession] LiveSession removed successfully', { connectionId })

        // Checks for any pending messages in the queue after removing the live session
        this.checkPendingMessagesInQueue(dto)

        // Unsubscribes from the Redis channel for the connection ID
        this.redisSubscriber.unsubscribe(connectionId)
        return true
      } else {
        this.logger.debug('[removeLiveSession] No LiveSession found for connectionId', { connectionId })
        return false
      }
    } catch (error) {
      // Logs any errors encountered during the process and returns false
      this.logger.error('[removeLiveSession] Error removing LiveSession', {
        connectionId,
        error: error.message,
      })
      return false
    }
  }

  /**
   * Sends a push notification to a specified token with the given messageID.
   *
   * @param {string} token - The token of the device to send the notification to.
   * @param {string} messageId - The ID of the message associated with the notification.
   * @returns {Promise<boolean>} - A promise that resolves to true if the notification was sent successfully, or false if an error occurs.
   */
  async sendPushNotification(token: string, messageId: string): Promise<boolean> {
    try {
      this.logger?.debug(`[sendPushNotification] Initialize send notification`)

      // Retrieves the push notification URL from the configuration service
      const pushNotificationUrl = this.configService.get<string>('appConfig.pushNotificationUrl')

      // Sends the push notification via HTTP POST request
      const response = await lastValueFrom(
        this.httpService.post(pushNotificationUrl, {
          token,
          messageId,
        }),
      )

      this.logger?.debug(`[sendPushNotification] FCM response success: ${JSON.stringify(response.data, null, 2)}`)

      // Logs the success or failure of the push notification
      if (response.data.success) {
        this.logger?.debug(`[sendPushNotification] Success sending push notification: ${JSON.stringify(response.data)}`)
      } else {
        this.logger?.error(
          `[sendPushNotification] Push notification was not successful: ${JSON.stringify(response.data)}`,
        )
      }

      return response.data.success as boolean
    } catch (error) {
      // Logs any errors encountered during the process and returns false
      this.logger?.error(`[sendPushNotification] Error sending push notification: ${error.message}`)
      return false
    }
  }

  /**
   * Checks for messages in the queue that are in the "sending" state and updates them to "pending".
   *
   * @param {ConnectionIdDto} dto - Data transfer object containing the connection ID.
   * @param {string} dto.connectionId - The unique identifier of the connection.
   * @returns {Promise<number>} - A promise that resolves to the number of updated messages, or -1 if an error occurs.
   */
  async checkPendingMessagesInQueue(dto: ConnectionIdDto): Promise<number> {
    // Ensures the queuedMessage model is initialized before proceeding
    if (!this.queuedMessage) {
      this.logger.error('[checkPendingMessagesInQueue] queuedMessage model is not initialized')
      throw new Error('[checkPendingMessagesInQueue] queuedMessage model is not initialized')
    }

    const { connectionId } = dto

    this.logger.debug('[checkPendingMessagesInQueue] Method called with DTO:', dto)

    try {
      // Finds messages in the "sending" state for the specified connection ID
      const messagesToSend = await this.queuedMessage.find({
        state: MessageState.sending,
        connectionId,
      })

      if (messagesToSend.length > 0) {
        const messageIds = messagesToSend.map((message) => message._id)

        // Updates the state of these messages to "pending"
        const response = await this.queuedMessage.updateMany(
          { _id: { $in: messageIds } },
          { $set: { state: MessageState.pending } },
        )

        this.logger.debug('[checkPendingMessagesInQueue] Messages updated to "pending"', {
          connectionId,
          updatedCount: response.modifiedCount,
        })

        return response.modifiedCount
      } else {
        // Logs that no messages were found in the "sending" state
        this.logger.debug('[checkPendingMessagesInQueue] No messages in "sending" state')
        return 0
      }
    } catch (error) {
      // Logs the error and returns -1 if an exception occurs
      this.logger.error('[checkPendingMessagesInQueue] Error processing messages', {
        connectionId,
        error: error.message,
      })
      return -1
    }
  }
}
