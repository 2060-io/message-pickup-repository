import { Module } from '@nestjs/common'
import { RedisModule, RedisModuleOptions } from '@nestjs-modules/ioredis'
import { ConfigModule, ConfigService } from '@nestjs/config'

@Module({
  imports: [
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): RedisModuleOptions => {
        const redisType = configService.get<string>('appConfig.redisType', 'single')
        if (redisType === 'cluster') {
          return {
            type: 'cluster',
            nodes: [
              { host: 'localhost', port: 6371 },
              { host: 'localhost', port: 6372 },
              { host: 'localhost', port: 6373 },
              { host: 'localhost', port: 6374 },
              { host: 'localhost', port: 6375 },
              { host: 'localhost', port: 6376 },
            ],
            options: {
              natMap: {
                '172.29.0.2:6379': { host: 'localhost', port: 6371 },
                '172.29.0.3:6379': { host: 'localhost', port: 6372 },
                '172.29.0.4:6379': { host: 'localhost', port: 6373 },
                '172.29.0.5:6379': { host: 'localhost', port: 6374 },
                '172.29.0.6:6379': { host: 'localhost', port: 6375 },
                '172.29.0.7:6379': { host: 'localhost', port: 6376 },
              },
              redisOptions: {
                connectTimeout: 10000, // Maximum wait time for connection in milliseconds
                maxRetriesPerRequest: 5, // Maximum number of retries per request
                enableReadyCheck: true, // Ensure the cluster is ready before processing commands
                reconnectOnError(err: Error): boolean {
                  const targetError = 'READONLY'
                  if (err.message.includes(targetError)) {
                    console.error('Reconnect due to READONLY error:', err)
                    return true
                  }
                  return false
                },
              },
            },
          }
        } else {
          return {
            type: 'single',
            url: configService.get<string>('REDIS_URL', 'redis://localhost:6379'),
            options: {
              connectTimeout: 10000, // Maximum wait time for connection in milliseconds
              maxRetriesPerRequest: 5, // Maximum number of retries per request
              enableReadyCheck: true, // Ensure the instance is ready before processing commands
              reconnectOnError(err: Error): boolean {
                const targetError = 'READONLY'
                if (err.message.includes(targetError)) {
                  console.error('Reconnect due to READONLY error:', err)
                  return true
                }
                return false
              },
            },
          }
        }
      },
    }),
  ],
  exports: [RedisModule],
})
export class HandledRedisModule {}
