import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, HydratedDocument } from 'mongoose'
import { EncryptedMessage } from '../dto/messagerepository-websocket.dto'

/**
 * Represents a message queued for delivery, stored in the database.
 *
 * @typedef {HydratedDocument<StoreQueuedMessage>} StoreQueuedMessageDocument - The Mongoose document type for a queued message.
 */
export type StoreQueuedMessageDocument = HydratedDocument<StoreQueuedMessage>

@Schema({ timestamps: true })
export class StoreQueuedMessage extends Document {
  /**
   * The unique identifier of the message add with the queued message.
   * @type {string}
   */
  @Prop({ required: true, index: 1 })
  messageId: string
  /**
   * The unique identifier of the connection associated with the queued message.
   * @type {string}
   */
  @Prop({ required: true, index: 1 })
  connectionId: string

  /**
   * The encrypted message payload that is queued for delivery.
   * @type {EncryptedMessage}
   */
  @Prop({ type: Object, required: true })
  encryptedMessage: EncryptedMessage

  /**
   * The recipient keys (DIDs or other identifiers) associated with the message.
   * @type {string[]}
   */
  @Prop({ required: true })
  recipientKeys: string[]

  /**
   * The current state of the message (e.g., 'pending', 'sending').
   * @type {string}
   */
  @Prop()
  state?: string
  /**
   * The timestamp when the message was created.
   * Mongoose automatically creates this field when `timestamps: true` is set in the schema.
   * @type {Date}
   */
  createdAt?: Date

  /**
   * The timestamp when the message was last updated.
   * Mongoose automatically creates this field when `timestamps: true` is set in the schema.
   * @type {Date}
   */
  updatedAt?: Date
}

/**
 * The schema definition for the QueuedMessage model.
 * Includes timestamps for creation and update times.
 */
export const StoreQueuedMessageSchema = SchemaFactory.createForClass(StoreQueuedMessage)
