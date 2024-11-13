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
  RemoveAllMessagesDto,
} from './dto/messagerepository-websocket.dto'
import { StoreQueuedMessage } from './schemas/StoreQueuedMessage'
import { InjectRedis } from '@nestjs-modules/ioredis'
import { lastValueFrom } from 'rxjs'
import { HttpService } from '@nestjs/axios'
import { QueuedMessage } from '@credo-ts/core'
import { Server } from 'rpc-websockets'
import Redis from 'ioredis'
import { JsonRpcResponseSubscriber } from './interfaces/interfaces'

@Injectable()
export class WebsocketService {
  private readonly logger: Logger
  private readonly redisSubscriber: Redis
  private readonly redisPublisher: Redis
  private server: Server

  constructor(
    @InjectModel(StoreQueuedMessage.name) private queuedMessage: Model<StoreQueuedMessage>,
    @InjectRedis() private readonly redis: Redis,
    private configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.logger = new Logger(WebsocketService.name)
    this.redisSubscriber = this.redis.duplicate()
    this.redisPublisher = this.redis.duplicate()
    this.initializeRedisMessageListener()
  }

  async onModuleInit() {
    try {
      const pong = await this.redis.ping()
      this.logger.log(`Connected to Redis successfully, ping response: ${pong}`)
    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error.message)
    }
  }

  setServer(server: Server) {
    this.server = server
  }

  /**
   * Retrieves messages from both Redis and MongoDB based on the provided criteria.
   * Depending on the specified criteria, this method will retrieve messages either
   * by a byte size limit or by a count limit, pulling messages from both Redis and MongoDB.
   *
   * If `limitBytes` is defined in the DTO, messages will be retrieved up to the specified byte limit
   * using `takeMessagesWithByteCountLimit`. Otherwise, messages will be retrieved by a count limit
   * using `takeMessagesWithMessageCountLimit`.
   *
   * @param {TakeFromQueueDto} dto - Data transfer object containing the query parameters.
   * @param {string} dto.connectionId - The unique identifier of the connection.
   * @param {number} [dto.limit] - Optional limit on the number of messages to retrieve if `limitBytes` is not specified.
   * @param {number} [dto.limitBytes] - Optional byte size limit for retrieving messages.
   * @param {boolean} [dto.deleteMessages] - Optional flag to determine if messages should be deleted after retrieval.
   * @param {string} [dto.recipientDid] - Optional recipient identifier for filtering messages.
   * When set, retrieval is based on the cumulative byte size of messages rather than the count.
   *
   * @returns {Promise<QueuedMessage[]>} - A promise that resolves to an array of queued messages.
   * The array will contain messages retrieved either by byte size or by count, based on the criteria provided.
   */
  async takeFromQueue(dto: TakeFromQueueDto): Promise<QueuedMessage[]> {
    const { limitBytes } = dto

    this.logger.debug('[takeFromQueue] Method called with DTO:', dto)

    return limitBytes
      ? await this.takeMessagesWithByteCountLimit(dto)
      : await this.takeMessagesWithMessageCountLimit(dto)
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
      const redisMessageCount = await this.redis.llen(`connectionId:${connectionId}:queuemessages`)

      const mongoMessageCount = await this.queuedMessage.countDocuments({ connectionId })

      const messageCount = redisMessageCount + mongoMessageCount

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
  async addMessage(dto: AddMessageDto): Promise<{ messageId: string } | undefined> {
    const { connectionId, recipientDids, payload, token } = dto
    let receivedAt: Date
    let messageId: string

    try {
      // Generate a unique ID for the message
      messageId = new ObjectId().toString()
      receivedAt = new Date()

      // Calculate the size in bytes of the encrypted message to add database
      const encryptedMessageByteCount = Buffer.byteLength(JSON.stringify(payload), 'utf8')

      this.logger.debug(`[addMessage] Size Encrypted Message ${encryptedMessageByteCount} `)

      // Create a message object to store in Redis
      const messageData = {
        messageId,
        connectionId,
        recipientDids,
        encryptedMessage: payload,
        state: MessageState.pending,
        encryptedMessageByteCount,
        receivedAt,
      }

      // Store the message in Redis using connectionId as the key
      await this.redis.rpush(`connectionId:${connectionId}:queuemessages`, JSON.stringify(messageData))

      // test send message to publish channel connection id
      const messagePublish: QueuedMessage[] = [
        {
          id: messageId,
          receivedAt,
          encryptedMessage: payload,
        },
      ]

      this.logger.debug(`[addMessage] Message stored in Redis for connectionId ${connectionId}`)

      await this.redisPublisher.publish(connectionId, JSON.stringify(messagePublish))

      if (!(await this.getLiveSession(dto))) {
        // If not in a live session
        this.logger.debug(`[addMessage] connectionId not found in other instance`)

        if (token && messageId) {
          this.logger.debug(`[addMessage] Push notification parameters token: ${token}; MessageId: ${messageId}`)
          await this.sendPushNotification(token, messageId)
        }
      }
      return { messageId }
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
        const redisMessage = await this.redis.lrange(
          `connectionId:${connectionId}:queuemessages`,
          0,
          messageId.length - 1,
        )
        const messageIndex = redisMessage.findIndex((message) => {
          this.logger.debug(`*** Message: ${message} ****`)
          const parsedMessage = JSON.parse(message)
          return parsedMessage.messageId === messageId
        })
        this.logger.debug(`*** MessageIndex: ${messageIndex}***`)
        // Remove message if found
        if (messageIndex !== -1) {
          await this.redis.lrem(`connectionId:${connectionId}:queuemessages`, 1, redisMessage[messageIndex])
          this.logger.debug(`[removeMessages] Message ${messageId} removed from Redis for connectionId ${connectionId}`)
        } else {
          this.logger.warn(`[removeMessages] Message ${messageId} not found in Redis for connectionId ${connectionId}`)
        }
      }

      // Remove messages from MongoDB
      const response = await this.queuedMessage.deleteMany({
        connectionId: connectionId,
        messageId: { $in: messageIds.map((id) => new Object(id)) },
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
   * Removes all messages associated with the given connectionId and recipientDid.
   * Messages are removed from both Redis and MongoDB.
   *
   * @param removeAllMessagesDto - Data Transfer Object containing connectionId and recipientDid
   * @returns {Promise<void>} - This function does not return any value.
   * @throws {Error} - If the operation fails to remove messages.
   */
  async removeAllMessage(dto: RemoveAllMessagesDto): Promise<void> {
    const { connectionId, recipientDid } = dto
    this.logger.debug('[removeAllMessage] Method called with DTO:', dto)

    try {
      // Get the list of messages stored in Redis associated with the connectionId
      const key = `connectionId:${connectionId}:queuemessages`
      const messages = await this.redis.lrange(key, 0, -1) // Retrieve all messages from Redis

      // Filter messages that match the recipientDid
      const messagesToRemove = messages.filter((message) => {
        const parsedMessage = JSON.parse(message)
        return parsedMessage.recipientDids.includes(recipientDid)
      })

      // Remove the filtered messages from Redis
      for (const message of messagesToRemove) {
        await this.redis.lrem(key, 1, message) // Remove each message from the list in Redis
      }

      // Remove the corresponding messages from MongoDB
      await this.queuedMessage.deleteMany({
        connectionId,
        recipientKeys: recipientDid, // Assuming recipientDids is stored as an array in MongoDB
      })

      this.logger.log(
        `Successfully removed all messages for connectionId ${connectionId} and recipientDid ${recipientDid}`,
      )
    } catch (error) {
      this.logger.error(
        `Failed to remove messages for connectionId ${connectionId} and recipientDid ${recipientDid}`,
        error,
      )
      throw new Error('Failed to remove messages')
    }
  }

  /**
   * Retrieves the live session associated with the given connection ID.
   *
   * @param {ConnectionIdDto} dto - Data transfer object containing the connection ID.
   * @param {string} dto.connectionId - The unique identifier of the connection.
   * @returns {Promise<boolean>} - A promise that resolves true the livesession if found, or false if not found or  null an error occurs.
   */
  async getLiveSession(dto: ConnectionIdDto): Promise<boolean> {
    const { connectionId } = dto

    this.logger.debug('[getLiveSession] Looking up live session in Redis for connectionId', { connectionId })

    try {
      // Define the Redis key where the live session is stored
      const sessionKey = `liveSession:${connectionId}`

      // Attempt to retrieve the session from Redis
      const liveSessionData = await this.redis.hgetall(sessionKey)

      if (liveSessionData && liveSessionData.sessionId) {
        this.logger.debug('[getLiveSession] Live session found in Redis', { liveSessionData })

        return true
      } else {
        this.logger.debug('[getLiveSession] No live session found in Redis for connectionId', { connectionId })
        return false
      }
    } catch (error) {
      this.logger.error('[getLiveSession] Error retrieving live session from Redis', {
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
  async addLiveSession(dto: AddLiveSessionDto, socket_id: string): Promise<boolean> {
    const { connectionId, sessionId } = dto

    this.logger.debug('[addLiveSession] Initializing add LiveSession to DB', {
      connectionId,
      sessionId,
    })

    this.logger.debug('[addLiveSession] socket_id:', { socket_id })

    try {
      // Use another Redis connection (not the subscriber) for general commands
      const sessionKey = `liveSession:${connectionId}`
      const response = await this.redis.hmset(sessionKey, {
        sessionId,
        socket_id,
      })

      this.logger.debug('[addLiveSession] response:', { response })

      if (response === 'OK') {
        this.logger.log('[addLiveSession] LiveSession added successfully', { connectionId })

        // Use the general Redis connection (not the subscriber) to check subscribed channels
        const subscribedChannels = await this.redis.pubsub('CHANNELS')
        const isSubscribed = subscribedChannels.includes(connectionId)

        this.logger.debug(`[addLiveSession] subscribedChannels: ${subscribedChannels} - isSubscribed: ${isSubscribed}`)

        if (isSubscribed) {
          // If already subscribed, unsubscribe first using the subscriber Redis connection
          this.logger.log(`[addLiveSession] Already subscribed to ${connectionId}, unsubscribing first...`)
          await this.redisSubscriber.unsubscribe(connectionId, (err, count) => {
            if (err) this.logger.error(err.message)
            this.logger.log(`Unsubscribed ${count} from ${connectionId} channel.`)
          })
        }

        this.logger.debug('[addLiveSession] try subscribe')

        // Use redisSubscriber for subscriptions only
        await this.redisSubscriber.subscribe(connectionId, (err, count) => {
          if (err) this.logger.error(err.message)
          this.logger.log(`Subscribed ${count} to ${connectionId} channel.`)
        })

        return true
      } else {
        this.logger.error('[addLiveSession] Failed to add LiveSession', { connectionId })
        return false
      }
    } catch (error) {
      // Log any errors encountered during the process and return false
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

    this.logger.debug('[removeLiveSession] Initializing removal of LiveSession from Redis', { connectionId })

    try {
      // Define the Redis key where the live session is stored
      const sessionKey = `liveSession:${connectionId}`

      // Attempt to delete the live session from Redis
      const deleteResult = await this.redis.del(sessionKey)

      if (deleteResult > 0) {
        this.logger.debug('[removeLiveSession] LiveSession removed successfully from Redis', { connectionId })

        // Unsubscribe from the Redis channel for the connection ID
        await this.redisSubscriber.unsubscribe(connectionId)

        this.logger.debug('[removeLiveSession] Unsubscribed from Redis channel', { connectionId })
        return true
      } else {
        this.logger.debug('[removeLiveSession] No LiveSession found in Redis for connectionId', { connectionId })
        return false
      }
    } catch (error) {
      this.logger.error('[removeLiveSession] Error removing LiveSession from Redis', {
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

      if (!pushNotificationUrl) {
        this.logger?.error('[sendPushNotification] Push notification URL is not defined in appConfig')
        return false
      }

      this.logger?.debug(`[sendPushNotification] pushNotificationUrl: ${pushNotificationUrl}`)
      if (!token || !messageId) {
        this.logger?.error('[sendPushNotification] Invalid token or messageId')
        return false
      }

      this.logger?.debug(`[sendPushNotification] token: ${token} --- messageId: ${messageId}`)

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

  /**
   * Sends a message to a WebSocket client identified by its socket ID.
   * The function iterates over all connected WebSocket clients and checks if the client's ID matches
   * the given `socket_id`. If the client is found and its connection is open, the message is sent.
   *
   * @param {string} socket_id - The unique identifier of the WebSocket client to which the message will be sent.
   * @param {JsonRpcResponseSubscriber} message - The message to send, including:
   *   @property {string} jsonrpc - The JSON-RPC version, always '2.0'.
   *   @property {string} method - The method being invoked, in this case, 'messagesReceived'.
   *   @property {Object} params - An object containing:
   *     @property {string} connectionId - The ID of the connection associated with the message.
   *     @property {QueuedMessage[]} message - An array of messages to be sent.
   *     @property {string} id - messageId of the message being sent.
   * @returns {Promise<void>} - Resolves when the message is successfully sent, or logs a warning if no matching client is found.
   * @throws Will throw an error if an issue occurs during message transmission.
   */
  async sendMessageToClientById(socket_id: string, message: JsonRpcResponseSubscriber): Promise<void> {
    try {
      this.logger.debug(`[sendMessageToClientById] Sending message to WebSocket client: ${socket_id}`)
      let clientFound = false // Track if the client was found

      // Iterate over all connected WebSocket clients
      this.server.wss.clients.forEach(async (client) => {
        this.logger.debug(`[sendMessageToClientById] Find WebSocket client: ${socket_id}`)
        // Check if the client's ID matches the provided socket_id and if the connection is open

        if ((client as any)._id === socket_id && client.readyState === 1) {
          clientFound = true
          this.logger.debug(
            `[sendMessageToClientById] Sending message to WebSocket client: ${JSON.stringify((client as any)._id)}}`,
          )

          // Send the message to the client
          const sendMessage = client.send(JSON.stringify(message), (error) => {
            if (error) this.logger.debug(`*** Error send: ${error} ***`)
          })

          this.logger.log(
            `[sendMessageToClientById] Message sent successfully ${sendMessage} to client with ID: ${JSON.stringify((client as any)._id)}}`,
          )
          return
        }
      })

      // Log a warning if no client was found with the given socket_id
      if (!clientFound) {
        this.logger.warn(`[sendMessageToClientById] No WebSocket client found with ID: ${socket_id}`)
      }
    } catch (error) {
      // Log and throw an error if something goes wrong during the operation
      this.logger.error(`[sendMessageToClientById] Failed to send message to client with ID: ${socket_id}`, error.stack)
      throw new Error(`[sendMessageToClientById] Failed to send message: ${error.message}`)
    }
  }

  /**
   * Initializes the Redis message listener to handle incoming messages from subscribed channels.
   * This listener will log and delegate message handling to the `handleMessage` method.
   */
  private initializeRedisMessageListener(): void {
    this.logger.log('[initializeRedisMessageListener] Initializing Redis message listener')

    try {
      // Register the message listener for Redis channels
      this.redisSubscriber.on('message', (channel: string, message: string) => {
        this.logger.log(`*** [initializeRedisMessageListener] Received message from ${channel}: ${message} **`)

        // Delegate message processing to the handleMessage method
        this.handleMessage(channel, message)
      })

      this.logger.log('[initializeRedisMessageListener] Listener successfully registered')
    } catch (error) {
      // Log any errors that occur during listener initialization
      this.logger.error('[initializeRedisMessageListener] Error initializing message listener', {
        error: error.message,
      })
    }
  }

  /**
   * Handles incoming messages from a Redis channel, retrieves the associated socket ID from Redis,
   * and sends the message to the corresponding WebSocket client.
   *
   * @param {string} channel - The Redis channel (which corresponds to a connectionId) from which the message was received.
   * @param {string} message - The message content received from the Redis channel.
   * @returns {Promise<void>} - Returns nothing, but logs errors or actions.
   */
  private async handleMessage(channel: string, message: string): Promise<void> {
    this.logger.log(`[handleMessage] Processing message for channel: ${channel}`)

    try {
      // Recover the session data (including socket_id) from Redis using the connectionId (channel)
      const sessionKey = `liveSession:${channel}`
      const sessionData = await this.redis.hgetall(sessionKey)

      if (!sessionData) {
        this.logger.error(`[handleMessage] No session data found for connectionId: ${channel}`)
        return // Exit if no session data is found in Redis
      }

      const socket_id = sessionData.socket_id // Retrieve the socket_id associated with the connectionId
      this.logger.debug(`[handleMessage] Recovered socket_id: ${socket_id} for connectionId: ${channel}`)

      if (!socket_id) {
        this.logger.error(`[handleMessage] No socket_id found for connectionId: ${channel}`)
        return // Exit if socket_id is not found in the session data
      }

      // Parse and process the received message, and construct the JSON-RPC response
      const jsonRpcResponse: JsonRpcResponseSubscriber = {
        jsonrpc: '2.0',
        method: 'messagesReceived',
        params: {
          connectionId: channel, // The channel is treated as the connectionId
          messages: JSON.parse(message), // Parse the message to ensure it's valid JSON
          id: '',
        },
      }

      // Send the processed message to the WebSocket client using the recovered socket_id
      await this.sendMessageToClientById(socket_id, jsonRpcResponse)
      this.logger.log(`[handleMessage] Message sent to socket_id: ${socket_id}`)
    } catch (error) {
      // Log any errors encountered during the handling of the message
      this.logger.error(`[handleMessage] Error processing message for channel: ${channel}`, {
        error: error.message,
      })
    }
  }

  /**
   * Retrieves messages from both Redis and MongoDB up to a specified message count limit.
   *
   * @param {TakeFromQueueDto} dto - Data transfer object containing query parameters.
   * @returns {Promise<QueuedMessage[]>} - A promise that resolves to an array of queued messages.
   */
  private async takeMessagesWithMessageCountLimit(dto: TakeFromQueueDto): Promise<QueuedMessage[]> {
    const { connectionId, limit, recipientDid } = dto

    this.logger.debug('[takeMessagesWithLimit] Method called with DTO:', dto)

    try {
      // Query MongoDB with the provided connectionId or recipientDid, and state 'pending'
      const mongoMessages = await this.queuedMessage
        .find({
          $or: [{ connectionId }, { recipientKeys: recipientDid }],
          state: 'pending',
        })
        .sort({ createdAt: 1 })
        .limit(limit)
        .select({ messageId: 1, encryptedMessage: 1, createdAt: 1 })
        .lean()
        .exec()

      const mongoMappedMessages: QueuedMessage[] = mongoMessages.map((msg) => ({
        id: msg.messageId,
        receivedAt: msg.createdAt,
        encryptedMessage: msg.encryptedMessage,
      }))

      this.logger.debug(
        `[takeMessagesWithLimit] Fetched ${mongoMappedMessages.length} messages from MongoDB for connectionId ${connectionId}`,
      )

      // Retrieve messages from Redis
      const redisMessagesRaw = await this.redis.lrange(`connectionId:${connectionId}:queuemessages`, 0, limit - 1)
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
        `[takeMessagesWithLimit] Fetched ${redisMessages.length} messages from Redis for connectionId ${connectionId}`,
      )
      // Combine messages from Redis and MongoDB
      const combinedMessages: QueuedMessage[] = [...mongoMappedMessages, ...redisMessages]

      this.logger.debug(
        `[takeMessagesWithLimit] combinedMessages for connectionId ${connectionId}: ${combinedMessages}`,
      )

      return combinedMessages
    } catch (error) {
      this.logger.error('[takeMessagesWithLimit] Error retrieving messages from Redis and MongoDB:', {
        connectionId,
        error: error.message,
      })
      return []
    }
  }

  /**
   * Retrieves messages from both Redis and MongoDB up to a specified total size in bytes.
   *
   * @param {TakeFromQueueDto} dto - Data transfer object containing query parameters.
   * @returns {Promise<QueuedMessage[]>} - A promise that resolves to an array of queued messages.
   */
  private async takeMessagesWithByteCountLimit(dto: TakeFromQueueDto): Promise<QueuedMessage[]> {
    const { connectionId, recipientDid, limitBytes } = dto
    const maxMessageSizeBytes = limitBytes
    let currentSize = 0
    const combinedMessages: QueuedMessage[] = []

    try {
      // Step 1: Retrieve messages from MongoDB with size limit
      const mongoMessages = await this.queuedMessage
        .find({
          $or: [{ connectionId }, { recipientKeys: recipientDid }],
          state: 'pending',
        })
        .sort({ createdAt: 1 })
        .select({ messageId: 1, encryptedMessage: 1, createdAt: 1, encryptedMessageByteCount: 1 })
        .lean()
        .exec()

      for (const msg of mongoMessages) {
        const messageSize =
          msg.encryptedMessageByteCount || Buffer.byteLength(JSON.stringify(msg.encryptedMessage), 'utf8')

        if (currentSize + messageSize > maxMessageSizeBytes) break

        combinedMessages.push({
          id: msg.messageId,
          receivedAt: msg.createdAt,
          encryptedMessage: msg.encryptedMessage,
        })
        currentSize += messageSize
      }

      // Skip Redis if size limit reached
      if (currentSize >= maxMessageSizeBytes) {
        this.logger.debug(
          `[takeMessagesWithSize] Size limit reached with MongoDB messages for connectionId ${connectionId}`,
        )
        return combinedMessages
      }

      // Step 2: Retrieve messages from Redis with size limit
      const redisMessagesRaw = await this.redis.lrange(`connectionId:${connectionId}:queuemessages`, 0, -1)

      for (const message of redisMessagesRaw) {
        const parsedMessage = JSON.parse(message)
        const messageSize =
          parsedMessage.sizeInBytes || Buffer.byteLength(JSON.stringify(parsedMessage.encryptedMessage), 'utf8')

        if (currentSize + messageSize > maxMessageSizeBytes) break

        combinedMessages.push({
          id: parsedMessage.messageId,
          receivedAt: new Date(parsedMessage.receivedAt),
          encryptedMessage: parsedMessage.encryptedMessage,
        })
        currentSize += messageSize
      }

      this.logger.debug(
        `[takeMessagesWithSize] Fetched ${combinedMessages.length} total messages for connectionId ${connectionId}`,
      )

      this.logger.debug(
        `[takeMessagesWithSize] Total message size to be sent for connectionId ${connectionId}: ${currentSize} bytes`,
      )

      return combinedMessages
    } catch (error) {
      this.logger.error(
        `[takeMessagesWithSize] Error retrieving messages for connectionId ${connectionId}: ${error.message}`,
      )
      return []
    }
  }
}
