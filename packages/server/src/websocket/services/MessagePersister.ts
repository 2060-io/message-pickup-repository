import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import Redis from 'ioredis'
import { StoreQueuedMessage } from '../schemas/StoreQueuedMessage'

@Injectable()
export class MessagePersister {
  private readonly logger = new Logger(MessagePersister.name)

  constructor(
    @InjectModel(StoreQueuedMessage.name) private storeQueuedMessage: Model<StoreQueuedMessage>,
    private redis: Redis,
  ) {
    this.startMonitoring()
  }

  startMonitoring() {
    this.logger.log(`[startMonitoring] Initialize MessagePersister`)
    setInterval(() => this.migrateData(), 60000)
  }

  async migrateData() {
    this.logger.log(`[migrateData] Initialize MessagePersister`)
    const threshold = Date.now() - 60000
    const connectionIds = await this.redis.keys('connectionId:*:messages')

    for (const fullKey of connectionIds) {
      const messages = await this.redis.lrange(fullKey, 0, -1)
      for (const messageData of messages) {
        const message = JSON.parse(messageData)
        if (message.receivedAt < threshold) {
          try {
            await new this.storeQueuedMessage({
              messageId: message.messageId,
              connectionId: message.connectionId,
              recipientKeys: message.recipientDids,
              encryptedMessage: message.encryptedMessage,
              state: message.state,
              createdAt: new Date(message.receivedAt),
            }).save()
            await this.redis.lrem(fullKey, 1, messageData)
            this.logger.log(`[migrateData] Migrated and deleted message with key: ${fullKey}`)
          } catch (error) {
            this.logger.error('[migrateData] Failed to MessagePersister', { fullKey, error })
          }
        }
      }
    }
  }
}
