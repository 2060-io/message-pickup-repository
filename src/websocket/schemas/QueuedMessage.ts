import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, HydratedDocument } from 'mongoose'
import { EncryptedMessage } from '../dto/messagerepository-websocket.dto'

/**
 * Represents a message queued for delivery, stored in the database.
 *
 * @typedef {HydratedDocument<QueuedMessage>} QueuedMessageDocument - The Mongoose document type for a queued message.
 */
export type QueuedMessageDocument = HydratedDocument<QueuedMessage>

@Schema({ timestamps: true })
export class QueuedMessage extends Document {
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
}

/**
 * The schema definition for the QueuedMessage model.
 * Includes timestamps for creation and update times.
 */
export const QueuedMessageSchema = SchemaFactory.createForClass(QueuedMessage)
