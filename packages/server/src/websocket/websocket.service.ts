import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { ConfigService } from '@nestjs/config'
import { Model } from 'mongoose'
import { ObjectId } from 'mongodb'
import { MessageState } from '../config/constants'
import {
  AddMessageDto,
  RemoveMessagesDto,
  TakeFromQueueDto,
  ConnectionIdDto,
  AddLiveSessionDto,
} from './dto/messagerepository-websocket.dto'
import { StoreLiveSession } from './schemas/StoreLiveSession'
import { StoreQueuedMessage } from './schemas/StoreQueuedMessage'
import { InstanceRegistration } from './schemas/InstanceRegistration'
import { InjectRedis } from '@nestjs-modules/ioredis'
import { lastValueFrom } from 'rxjs'
import { HttpService } from '@nestjs/axios'
import { QueuedMessage } from '@credo-ts/core'
import Redis from 'ioredis'

@Injectable()
export class WebsocketService {
  private readonly logger: Logger
  private readonly httpService: HttpService
  private readonly redisSubscriber: Redis
  private readonly redisPublisher: Redis

  constructor(
    @InjectModel(StoreQueuedMessage.name) private queuedMessage: Model<StoreQueuedMessage>,
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
   * Retrieves messages from both Redis and MongoDB based on the provided criteria.
   * This method retrieves messages from Redis for the specified connection ID, as well as messages stored in MongoDB.
   *
   * @param {TakeFromQueueDto} dto - Data transfer object containing the query parameters.
   * @param {string} dto.connectionId - The unique identifier of the connection.
   * @param {number} [dto.limit] - Optional limit on the number of messages to retrieve.
   * @param {boolean} [dto.deleteMessages] - Optional flag to determine if messages should be deleted after retrieval.
   * @param {string} [dto.recipientDid] - Optional recipient identifier for filtering messages.
   * @returns {Promise<QueuedMessage[]>} - A promise that resolves to an array of queued messages.
   */
  async takeFromQueue(dto: TakeFromQueueDto): Promise<QueuedMessage[]> {
    const { connectionId, limit = 10, deleteMessages, recipientDid } = dto

    this.logger.debug('[takeFromQueue] Method called with DTO:', dto)

    try {
      // Retrieve messages from Redis
      const redisMessagesRaw = await this.redis.lrange(`connectionId:${connectionId}:messages`, 0, limit - 1)
      const redisMessages: QueuedMessage[] = redisMessagesRaw.map((message) => {
        const parsedMessage = JSON.parse(message)

        // Map Redis data to QueuedMessage type
        return {
          id: parsedMessage.messageId,
          receivedAt: new Date(parsedMessage.receivedAt),
          encryptedMessage: parsedMessage.encryptedMessage,
        }
      })

      this.logger.debug(
        `[takeFromQueue] Fetched ${redisMessages.length} messages from Redis for connectionId ${connectionId}`,
      )

      // Query MongoDB with the provided connectionId or recipientDid, and state 'pending'
      const mongoMessages = await this.queuedMessage
        .find({
          $or: [{ connectionId }, { recipientKeys: recipientDid }],
          state: 'pending',
        })
        .sort({ createdAt: 1 })
        .limit(limit)
        .select({ _id: 1, encryptedMessage: 1, createdAt: 1 })
        .lean()
        .exec()

      const mongoMappedMessages: QueuedMessage[] = mongoMessages.map((msg) => ({
        id: msg._id.toString(),
        receivedAt: msg.createdAt,
        encryptedMessage: msg.encryptedMessage,
      }))

      this.logger.debug(
        `[takeFromQueue] Fetched ${mongoMappedMessages.length} messages from MongoDB for connectionId ${connectionId}`,
      )

      // Combine messages from Redis and MongoDB
      const combinedMessages: QueuedMessage[] = [...redisMessages, ...mongoMappedMessages]

      return combinedMessages
    } catch (error) {
      this.logger.error('[takeFromQueue] Error retrieving messages from Redis and MongoDB:', {
        connectionId,
        error: error.message,
      })
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
    const { connectionId } = dto

    this.logger.debug('[getAvailableMessageCount] Initializing method', { connectionId })

    try {
      // retrieve the list count of messages for the connection
      const messageCount = await this.redis.llen(`connectionId:${connectionId}:messages`)

      this.logger.debug(`[getAvailableMessageCount] Message count retrieved for connectionId ${connectionId}`, {
        messageCount,
      })

      return messageCount
    } catch (error) {
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
  async addMessage(dto: AddMessageDto): Promise<{ connectionId: string; receivedAt: Date } | undefined> {
    const { connectionId, recipientDids, payload, token } = dto
    let receivedAt: Date
    let messageId: string

    try {
      // Generate a unique ID for the message
      messageId = new ObjectId().toString()
      receivedAt = new Date()

      // Create a message object to store in Redis
      const messageData = {
        messageId,
        connectionId,
        recipientDids,
        encryptedMessage: payload,
        state: MessageState.pending,
        receivedAt,
      }

      // Store the message in Redis using connectionId as the key
      await this.redis.rpush(`connectionId:${connectionId}:messages`, JSON.stringify(messageData))

      this.logger.debug(`[addMessage] Message stored in Redis for connectionId ${connectionId}`)

      await this.redisPublisher.publish(connectionId, 'new message')

      if (!(await this.getLiveSession(dto))) {
        // If not in a live session
        this.logger.debug(`[addMessage] connectionId not found in other instance`)

        if (token && messageId) {
          this.logger.debug(`[addMessage] Push notification parameters token: ${token}; MessageId: ${messageId}`)
          await this.sendPushNotification(token, messageId)
        }
      }
      return { connectionId, receivedAt }
    } catch (error) {
      this.logger.error(`[addMessage] Error adding message to queue: ${error.message}`)
      return undefined
    }
  }

 
  /**
   * Removes messages from both Redis and MongoDB based on the provided connection ID and message IDs.
   * This method ensures that messages are removed from Redis as well as MongoDB.
   *
   * @param {RemoveMessagesDto} dto - Data transfer object containing the connection ID and message IDs to be removed.
   * @param {string} dto.connectionId - The unique identifier of the connection.
   * @param {string[]} dto.messageIds - Array of message IDs to be removed from the queue.
   * @returns {Promise<void>} - No return value, resolves when messages are removed.
   */
  async removeMessages(dto: RemoveMessagesDto): Promise<void> {
    const { connectionId, messageIds } = dto

    this.logger.debug('[removeMessages] Method called with DTO:', dto)

    try {
      // Remove messages from Redis
      for (const messageId of messageIds) {
        // remove specific messages from Redis
        const redisMessage = await this.redis.lrange(`connectionId:${connectionId}:messages`, 0, messageId.length - 1)
        const messageIndex = redisMessage.findIndex((message) => {
          this.logger.debug(`*** Message: ${message} ****`)
          const parsedMessage = JSON.parse(message)
          return parsedMessage.messageId === messageId
        })
        this.logger.debug(`*** MessageIndex: ${messageIndex}***`)
        // Remove message if found
        if (messageIndex !== -1) {
          await this.redis.lrem(`connectionId:${connectionId}:messages`, 1, redisMessage[messageIndex])
          this.logger.debug(`[removeMessages] Message ${messageId} removed from Redis for connectionId ${connectionId}`)
        } else {
          this.logger.warn(`[removeMessages] Message ${messageId} not found in Redis for connectionId ${connectionId}`)
        }
      }

      // Remove messages from MongoDB
      const response = await this.queuedMessage.deleteMany({
        connectionId: connectionId,
        _id: { $in: messageIds.map((id) => new Object(id)) },
      })

      this.logger.debug('[removeMessages] Messages removed from MongoDB', {
        connectionId,
        messageIds,
        deletedCount: response.deletedCount,
      })
    } catch (error) {
      // Log the error
      this.logger.error('[removeMessages] Error removing messages from Redis and MongoDB', {
        connectionId,
        messageIds,
        error: error.message,
      })
      throw error
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
          this.logger.log(`Subscribed ${count} to ${connectionId} channel.`)
        })

        // Handles messages received on the subscribed Redis channel
        this.redisSubscriber.on('message', (channel: string, message: string) => {
          if (channel === connectionId) {
            this.logger.log(`** Received message from ${channel}: ${message} **`)
            // TODO: Handle the new message for the connectionId
            //this.takeFromQueue()
            //Client.notify('messageReceipt',option{connectionId,this.queuedMessage})
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
