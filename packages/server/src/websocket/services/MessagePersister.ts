import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { StoreQueuedMessage } from '../schemas/StoreQueuedMessage'
import { Model } from 'mongoose'
import Redis from 'ioredis'
import { InjectRedis } from '@nestjs-modules/ioredis'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class MessagePersister {
  private readonly logger = new Logger(MessagePersister.name)
  private thresholdTimestamp: number

  constructor(
    @InjectModel(StoreQueuedMessage.name) private storeQueuedMessage: Model<StoreQueuedMessage>,
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    this.startMonitoring()
  }

  startMonitoring() {
    this.logger.log(`[startMonitoring] Initialize MessagePersister`)
    this.thresholdTimestamp = this.configService.get<number>('appConfig.thresholdTimestamp', 60000)
    setInterval(() => this.migrateData(), this.thresholdTimestamp)
  }

  async migrateData() {
    this.logger.log(`[migrateData] Initialize MessagePersister`)

    // Calculate the threshold timestamp (messages older than 60 seconds will be migrated)
    const threshold = Date.now() - this.thresholdTimestamp
    this.logger.log(`[migrateData] Threshold timestamp calculated: ${threshold}`)

    // Get the keys for messages in Redis that match the pattern
    const connectionIds = await this.redis.keys('connectionId:*:queuemessages')
    this.logger.log(`[migrateData] Found ${connectionIds.length} connectionIds matching the pattern`)

    // Iterate over each connection key
    for (const fullKey of connectionIds) {
      this.logger.log(`[migrateData] Processing Redis key: ${fullKey}`)

      // Fetch all messages from the Redis list
      const messages = await this.redis.lrange(fullKey, 0, -1)
      this.logger.log(`[migrateData] Found ${messages.length} messages in key: ${fullKey}`)

      // Iterate over each message in the list
      for (const messageData of messages) {
        const message = JSON.parse(messageData)
        this.logger.log(`[migrateData] Processing message with messageId: ${message.messageId}`)

        this.logger.log(`[migrateData] receivedAt : ${message.receivedAt} *** threshold ${threshold} `)
        const receivedAtTimestamp = new Date(message.receivedAt).getTime()
        // Check if the message is older than the threshold
        if (receivedAtTimestamp < threshold) {
          this.logger.log(`[migrateData] Message is older than threshold, migrating...`)

          try {
            // Save the message to MongoDB
            await this.storeQueuedMessage.create({
              messageId: message.messageId,
              connectionId: message.connectionId,
              recipientKeys: message.recipientDids,
              encryptedMessage: message.encryptedMessage,
              state: message.state,
              createdAt: new Date(message.receivedAt),
            })

            // Remove the message from Redis after migration
            await this.redis.lrem(fullKey, 1, messageData)
            this.logger.log(
              `[migrateData] Migrated and deleted message with key: ${fullKey} and messageId: ${message.messageId}`,
            )
          } catch (error) {
            // Log the error if migration fails
            this.logger.error('[migrateData] Failed to migrate message', {
              fullKey,
              messageId: message.messageId,
              error,
            })
          }
        } else {
          // Skip the message if it is not old enough
          this.logger.log(`[migrateData] Message with messageId: ${message.messageId} is not old enough, skipping...`)
        }
      }
    }
  }
}
