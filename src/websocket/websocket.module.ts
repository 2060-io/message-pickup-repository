import { Module } from '@nestjs/common'
import { WebsocketService } from './websocket.service'
import { WebsocketGateway } from './websocket.gateway'
import { MongooseModule } from '@nestjs/mongoose'
import { QueuedMessageSchema, QueuedMessage } from './schemas/QueuedMessage'
import { StoreLiveSessionSchema, StoreLiveSession } from './schemas/StoreLiveSession'
import { InstanceRegistration, InstanceRegistrationSchema } from './schemas/InstanceRegistration'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: QueuedMessage.name, schema: QueuedMessageSchema },
      { name: StoreLiveSession.name, schema: StoreLiveSessionSchema },
      { name: InstanceRegistration.name, schema: InstanceRegistrationSchema },
    ]),
  ],
  providers: [WebsocketGateway, WebsocketService],
})
export class WebsocketModule {}
