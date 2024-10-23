import { Module } from '@nestjs/common'
import { WebsocketService } from '../src/websocket/websocket.service'
import { WebsocketGateway } from '../src/websocket/websocket.gateway'
import { MongooseModule } from '@nestjs/mongoose'
import { StoreQueuedMessageSchema, StoreQueuedMessage } from '../src/websocket/schemas/StoreQueuedMessage'
import { StoreLiveSessionSchema, StoreLiveSession } from '../src/websocket/schemas/StoreLiveSession'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StoreQueuedMessage.name, schema: StoreQueuedMessageSchema },
      { name: StoreLiveSession.name, schema: StoreLiveSessionSchema },
    ]),
  ],
  providers: [WebsocketGateway, WebsocketService],
})
export class WebsocketTestModule {}
