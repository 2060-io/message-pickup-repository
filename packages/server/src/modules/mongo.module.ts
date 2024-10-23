import { Module } from '@nestjs/common'
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose'
import { ConfigModule, ConfigService } from '@nestjs/config'

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService): Promise<MongooseModuleOptions> => ({
        uri: configService.get<string>('appConfig.mongoDbUri'),
        retryDelay: 2,
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [MongooseModule],
})
export class HandledMongooseModule {}
