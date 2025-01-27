import { Module } from '@nestjs/common'
import { WebsocketService } from '../src/websocket/websocket.service'
import { WebsocketGateway } from '../src/websocket/websocket.gateway'
import { MongooseModule } from '@nestjs/mongoose'
import { StoreQueuedMessageSchema, StoreQueuedMessage } from '../src/websocket/schemas/StoreQueuedMessage'
import { StoreLiveSessionSchema, StoreLiveSession } from '../src/websocket/schemas/StoreLiveSession'
import { HttpModule } from '@nestjs/axios'
import { FcmNotificationSender } from '../src/providers/FcmNotificationSender'
import { ApnNotificationSender } from '../src/providers/ApnNotificationSender'
import { PushNotificationQueueService } from '../src/providers/PushNotificationQueueService'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StoreQueuedMessage.name, schema: StoreQueuedMessageSchema },
      { name: StoreLiveSession.name, schema: StoreLiveSessionSchema },
    ]),
    HttpModule,
  ],
  providers: [
    WebsocketGateway,
    WebsocketService,
    FcmNotificationSender,
    ApnNotificationSender,
    PushNotificationQueueService,
  ],
})
export class WebsocketTestModule {}
