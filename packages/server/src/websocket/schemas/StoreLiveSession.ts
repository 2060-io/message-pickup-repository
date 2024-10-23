import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, HydratedDocument } from 'mongoose'

/**
 * Represents a live session stored in the database.
 *
 * @typedef {HydratedDocument<StoreLiveSession>} StoreLiveSessionDocument - The Mongoose document type for a live session.
 */
export type StoreLiveSessionDocument = HydratedDocument<StoreLiveSession>

@Schema({ timestamps: true })
export class StoreLiveSession extends Document {
  /**
   * The unique identifier of the connection associated with the live session.
   * @type {string}
   */
  @Prop({ required: true, index: 1 })
  connectionId: string

  /**
   * The session ID associated with the live session.
   * @type {string}
   */
  @Prop({ required: true })
  sessionId: string
}

/**
 * The schema definition for the StoreLiveSession model.
 * Includes timestamps for creation and update times.
 */
export const StoreLiveSessionSchema = SchemaFactory.createForClass(StoreLiveSession)
