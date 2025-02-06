import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { StoreQueuedMessage } from '../schemas/StoreQueuedMessage'
import { Model } from 'mongoose'
import Redis from 'ioredis'
import { InjectRedis } from '@nestjs-modules/ioredis'
import { ConfigService } from '@nestjs/config'
import * as os from 'os'

@Injectable()
export class MessagePersister implements OnModuleDestroy {
  private readonly logger = new Logger(MessagePersister.name)
  private thresholdTimestamp: number
  private readonly lockKey = 'message_persister_master'
  private readonly lockTTL = 60000 // 1 minute TTL
  private renewInterval: NodeJS.Timeout | null = null
  private checkInterval: NodeJS.Timeout | null = null
  private readonly instanceId = os.hostname() // Unique ID for this instance

  constructor(
    @InjectModel(StoreQueuedMessage.name) private storeQueuedMessage: Model<StoreQueuedMessage>,
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    this.initiateMasterRole()
  }

  // Attempts to acquire the mastership role and start the monitoring process if successful
  initiateMasterRole() {
    this.checkInterval = setInterval(async () => {
      const isLeader = await this.acquireLock()
      if (isLeader) {
        this.logger.log(`[initiateMasterRole] This instance (${this.instanceId}) has acquired mastership.`)
        this.startMonitoring()
        this.renewLockPeriodically()
        clearInterval(this.checkInterval) // Stop trying to acquire lock once acquired
      } else {
        this.logger.log(`[initiateMasterRole] Another instance is currently the master.`)
      }
    }, this.lockTTL) // Attempt to acquire mastership every TTL interval
  }

  // Tries to acquire the Redis lock to become the master
  async acquireLock(): Promise<boolean> {
    try {
      this.logger.debug(`[acquireLock] Attempting to acquire lock with key ${this.lockKey}`)

      // Attempt to set the lock with NX (only if it does not exist) and PX (with TTL)
      const result = await (this.redis.set as any)(this.lockKey, this.instanceId, 'NX', 'PX', this.lockTTL)

      // If result is OK, lock was acquired successfully
      if (result === 'OK') {
        this.logger.debug(`[acquireLock] Lock acquired successfully by instance ${this.instanceId}`)
        return true
      }

      // Otherwise, log the current lock holder
      const currentLockHolder = await this.redis.get(this.lockKey)
      this.logger.debug(`[acquireLock] Lock is currently held by instance: ${currentLockHolder}`)
      return false
    } catch (error) {
      this.logger.error(`[acquireLock] Error acquiring lock: ${error}`)
      return false
    }
  }

  // Periodically renews the lock to maintain mastership
  renewLockPeriodically() {
    this.renewInterval = setInterval(async () => {
      try {
        // Check if this instance still holds the lock before renewing
        const currentLockHolder = await this.redis.get(this.lockKey)
        if (currentLockHolder === this.instanceId) {
          await this.redis.pexpire(this.lockKey, this.lockTTL)
          this.logger.debug(`[renewLockPeriodically] Lock renewed by instance ${this.instanceId}`)
        } else {
          this.logger.warn(`[renewLockPeriodically] Lock is no longer held by instance ${this.instanceId}`)
          this.clearMasterShip() // Relinquish mastership if another instance took the lock
        }
      } catch (error) {
        this.logger.error(`[renewLockPeriodically] Error renewing lock: ${error}`)
        this.clearMasterShip() // Relinquish mastership if unable to renew
      }
    }, this.lockTTL / 2) // Renew before the TTL expires
  }

  // Clear mastership if lock renewal fails or another instance acquires it
  clearMasterShip() {
    if (this.renewInterval) {
      clearInterval(this.renewInterval)
      this.renewInterval = null
    }
    if (!this.checkInterval) {
      this.initiateMasterRole() // Restart attempting to acquire mastership if lost
    }
    this.logger.log('[clearMasterShip] Mastership relinquished.')
  }

  // Releases the lock when the module is destroyed, allowing another instance to become master
  onModuleDestroy() {
    if (this.renewInterval) {
      clearInterval(this.renewInterval)
    }
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }
    this.redis.del(this.lockKey) // Releases the lock on shutdown
    this.logger.log(`[onModuleDestroy] Lock released by instance ${this.instanceId}`)
  }

  // Starts the monitoring and migration process if this instance is the master
  startMonitoring() {
    this.logger.log(`[startMonitoring] Initialize MessagePersister`)
    this.thresholdTimestamp = this.configService.get<number>('appConfig.thresholdTimestamp', 60000)
    setInterval(() => this.persistMessages(), this.thresholdTimestamp)
  }

  // Migrates messages from Redis to MongoDB if they meet the age threshold
  async persistMessages() {
    this.logger.log(`[persistMessages] Initialize MessagePersister`)

    const threshold = Date.now() - this.thresholdTimestamp
    this.logger.log(`[persistMessages] Threshold timestamp calculated: ${threshold}`)

    const connectionIds = await this.redis.keys('connectionId:*:queuemessages')
    this.logger.log(`[persistMessages] Found ${connectionIds.length} connectionIds matching the pattern`)

    for (const fullKey of connectionIds) {
      this.logger.log(`[persistMessages] Processing Redis key: ${fullKey}`)
      const messages = await this.redis.lrange(fullKey, 0, -1)
      this.logger.log(`[persistMessages] Found ${messages.length} messages in key: ${fullKey}`)

      for (const messageData of messages) {
        const message = JSON.parse(messageData)
        this.logger.log(`[persistMessages] Processing message with messageId: ${message.messageId}`)
        const receivedAtTimestamp = new Date(message.receivedAt).getTime()

        if (receivedAtTimestamp < threshold) {
          this.logger.log(`[persistMessages] Message is older than threshold, migrating...`)
          try {
            await this.storeQueuedMessage.create({
              messageId: message.messageId,
              connectionId: message.connectionId,
              recipientKeys: message.recipientDids,
              encryptedMessage: message.encryptedMessage,
              encryptedMessageSize: message.encryptedMessageSize,
              state: message.state,
              createdAt: new Date(message.receivedAt),
            })
            await this.redis.lrem(fullKey, 1, messageData)
            this.logger.log(
              `[persistMessages] Migrated and deleted message with key: ${fullKey} and messageId: ${message.messageId}`,
            )
          } catch (error) {
            this.logger.error('[persistMessages] Failed to migrate message', {
              fullKey,
              messageId: message.messageId,
              error,
            })
          }
        } else {
          this.logger.log(
            `[persistMessages] Message with messageId: ${message.messageId} is not old enough, skipping...`,
          )
        }
      }
    }
  }
}
