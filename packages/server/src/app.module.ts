import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { WebsocketModule } from './websocket/websocket.module'
import { HandledRedisModule } from './modules/redis.module'
import { HandledMongooseModule } from './modules/mongo.module'
import appConfig from './config/app.config'

@Module({
  imports: [
    WebsocketModule,
    ConfigModule.forRoot({
      envFilePath: '.env',
      load: [appConfig],
      isGlobal: true,
    }),
    HandledMongooseModule,
    HandledRedisModule,
  ],
  controllers: [],
  providers: [HandledMongooseModule, HandledRedisModule],
})
export class AppModule {}
