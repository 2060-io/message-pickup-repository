import { Module } from '@nestjs/common'
import { WebsocketService } from './websocket.service'
import { WebsocketGateway } from './websocket.gateway'
import { MongooseModule } from '@nestjs/mongoose'
import { StoreQueuedMessageSchema, StoreQueuedMessage } from './schemas/StoreQueuedMessage'
import { StoreLiveSessionSchema, StoreLiveSession } from './schemas/StoreLiveSession'
import { MessagePersister } from './services/MessagePersister'
import { HttpModule } from '@nestjs/axios'
import { FcmNotificationSender } from '../providers/firebase-config'
import { QueueService } from '../providers/queue-service'
import { ApnNotificationSender } from '../providers/apns-config'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StoreQueuedMessage.name, schema: StoreQueuedMessageSchema },
      { name: StoreLiveSession.name, schema: StoreLiveSessionSchema },
    ]),
    HttpModule,
  ],
  providers: [WebsocketGateway, WebsocketService, MessagePersister, ...configNotificationModule()],
})
export class WebsocketModule {}

function configNotificationModule(): any[] {
  const provider = process.env.NOTIFICATION_PROVIDER || 'fcm'

  if (provider === 'fcm') {
    return [FcmNotificationSender, QueueService]
  } else if (provider === 'apns') {
    return [ApnNotificationSender]
  } else {
    throw new Error('Invalid notificationProvider value in appConfig. Expected "fcm" or "apns".')
  }
}
