import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, HydratedDocument } from 'mongoose'

/**
 * Represents the registration details of an instance in the system, stored in the database.
 *
 * @typedef {HydratedDocument<InstanceRegistration>} InstanceRegistrationDocument - The Mongoose document type for an instance registration.
 */
export type InstanceRegistrationDocument = HydratedDocument<InstanceRegistration>

@Schema({ timestamps: true })
export class InstanceRegistration extends Document {
  /**
   * The unique identifier of the connection associated with the instance registration.
   * @type {string}
   */
  @Prop({ required: true })
  connectionId: string

  /**
   * The IP address of the registered instance.
   * @type {string}
   */
  @Prop({ required: true })
  ipaddress: string

  /**
   * The port number used by the registered instance.
   * @type {string}
   */
  @Prop({ required: true })
  port: string

  /**
   * The DNS (Domain Name System) address of the registered instance.
   * @type {string}
   */
  @Prop({ required: true })
  dns: string
}

/**
 * The schema definition for the InstanceRegistration model.
 * Includes timestamps for creation and update times.
 */
export const InstanceRegistrationSchema = SchemaFactory.createForClass(InstanceRegistration)
