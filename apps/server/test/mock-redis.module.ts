import { Module, Global } from '@nestjs/common'

@Global()
@Module({
  providers: [
    {
      provide: 'default_IORedisModuleConnectionToken',
      useValue: {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        lrange: jest.fn(),
        lrem: jest.fn(),
        quit: jest.fn(),
        ping: jest.fn().mockResolvedValue('PONG'),
        keys: jest.fn().mockResolvedValue([]),
        duplicate: jest.fn().mockReturnThis(),
      },
    },
  ],
  exports: ['default_IORedisModuleConnectionToken'],
})
export class MockRedisModule {}
