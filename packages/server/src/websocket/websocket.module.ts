import { Module } from '@nestjs/common'
import { WebsocketService } from './websocket.service'
import { WebsocketGateway } from './websocket.gateway'
import { MongooseModule } from '@nestjs/mongoose'
import { StoreQueuedMessageSchema, StoreQueuedMessage } from './schemas/StoreQueuedMessage'
import { StoreLiveSessionSchema, StoreLiveSession } from './schemas/StoreLiveSession'
import { MessagePersister } from './services/MessagePersister'
import { HttpModule } from '@nestjs/axios'
import { FcmNotificationSender } from '../providers/FcmNotificationSender'
import { PushNotificationQueueService } from '../providers/PushNotificationQueueService'
import { ApnNotificationSender } from '../providers/ApnNotificationSender'

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
    MessagePersister,
    FcmNotificationSender,
    ApnNotificationSender,
    PushNotificationQueueService,
  ],
})
export class WebsocketModule {}
