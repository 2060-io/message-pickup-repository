import { Test, TestingModule } from '@nestjs/testing'
import { WebsocketService } from './websocket.service'
import { getModelToken } from '@nestjs/mongoose'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'

describe('WebsocketService', () => {
  let service: WebsocketService

  // Mocks de los modelos de Mongoose
  const mockQueuedMessageModel = {
    find: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  }

  const mockLiveSessionModel = {
    findOne: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  }

  const mockConfigService = {
    get: jest.fn().mockReturnValue('some-value'),
  }

  const mockRedisClient = {
    on: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebsocketService,
        { provide: getModelToken('StoreQueuedMessage'), useValue: mockQueuedMessageModel },
        { provide: getModelToken('StoreLiveSession'), useValue: mockLiveSessionModel },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: Redis, useValue: mockRedisClient },
      ],
    }).compile()

    service = module.get<WebsocketService>(WebsocketService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
