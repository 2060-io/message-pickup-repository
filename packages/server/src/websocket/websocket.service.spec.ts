import { Test, TestingModule } from '@nestjs/testing'
import { WebsocketService } from './websocket.service'
import { getModelToken } from '@nestjs/mongoose'
import { HttpService } from '@nestjs/axios'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'

describe('WebsocketService', () => {
  let service: WebsocketService
  let redisMock: Redis
  let httpServiceMock: HttpService
  let configServiceMock: ConfigService
  let storeQueuedMessageMock: any

  beforeEach(async () => {
    // Mock Redis
    redisMock = new Redis()
    jest.spyOn(redisMock, 'duplicate').mockReturnValue(redisMock)
    jest.spyOn(redisMock, 'ping').mockResolvedValue('PONG')
    jest.spyOn(redisMock, 'lrange').mockResolvedValue([
      JSON.stringify({
        messageId: '1',
        encryptedMessage: 'test-message-1',
        receivedAt: new Date(),
      }),
    ])

    // Mock StoreQueuedMessage Model
    storeQueuedMessageMock = {
      find: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        {
          messageId: '2',
          encryptedMessage: 'test-message-2',
          createdAt: new Date(),
        },
      ]),
    }

    httpServiceMock = {
      post: jest.fn(),
    } as unknown as HttpService

    configServiceMock = {
      get: jest.fn().mockReturnValue('mocked-url'),
    } as unknown as ConfigService

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebsocketService,
        { provide: getModelToken('StoreQueuedMessage'), useValue: storeQueuedMessageMock },
        { provide: 'default_IORedisModuleConnectionToken', useValue: redisMock },
        { provide: HttpService, useValue: httpServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile()

    service = module.get<WebsocketService>(WebsocketService)
  })

  afterEach(async () => {
    // Close Redis connections
    await redisMock.quit()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should takeFromQueue (Redis and MongoDB) with size message', async () => {
    // Mock configuration for Redis
    jest.spyOn(redisMock, 'lrange').mockResolvedValue([
      JSON.stringify({
        id: '1', // Usar 'id' en lugar de 'messageId'
        encryptedMessage: 'test-message-2',
        receivedAt: new Date().toISOString(),
      }),
    ])

    // Mock configuration for MongoDB
    storeQueuedMessageMock.exec.mockResolvedValue([
      {
        id: '2', // MongoDB usa _id por defecto
        encryptedMessage: 'test-message-1',
        createdAt: new Date(),
      },
    ])

    // Execute the takeFromQueue method
    const result = await service.takeFromQueue({
      connectionId: 'test-connection-id',
      id: '',
      limitBytes: 1000000,
    })

    // Verify that Redis and MongoDB calls were made
    expect(redisMock.lrange).toHaveBeenCalledWith('connectionId:test-connection-id:queuemessages', 0, -1)
    expect(storeQueuedMessageMock.find).toHaveBeenCalledWith({
      $or: [{ connectionId: 'test-connection-id' }, { recipientKeys: undefined }],
      state: 'pending',
    })

    // Verify the combined result from Redis and MongoDB
    expect(result).toHaveLength(2)
    expect(result[0].encryptedMessage).toBe('test-message-1') // Verifica por 'id'
    expect(result[1].encryptedMessage).toBe('test-message-2') // Verifica por 'id'
  })

  it('should takeFromQueue (Redis and MongoDB) with limit message', async () => {
    // Mock configuration for Redis
    jest.spyOn(redisMock, 'lrange').mockResolvedValue([
      JSON.stringify({
        id: '1', // Usar 'id' en lugar de 'messageId'
        encryptedMessage: 'test-message-2',
        receivedAt: new Date().toISOString(),
      }),
    ])

    // Mock configuration for MongoDB
    storeQueuedMessageMock.exec.mockResolvedValue([
      {
        id: '2', // MongoDB usa _id por defecto
        encryptedMessage: 'test-message-1',
        createdAt: new Date(),
      },
    ])

    // Execute the takeFromQueue method
    const result = await service.takeFromQueue({
      connectionId: 'test-connection-id',
      id: '',
      limit: 0,
    })

    // Verify that Redis and MongoDB calls were made
    expect(redisMock.lrange).toHaveBeenCalledWith('connectionId:test-connection-id:queuemessages', 0, -1)
    expect(storeQueuedMessageMock.find).toHaveBeenCalledWith({
      $or: [{ connectionId: 'test-connection-id' }, { recipientKeys: undefined }],
      state: 'pending',
    })

    // Verify the combined result from Redis and MongoDB
    expect(result).toHaveLength(2)
    expect(result[0].encryptedMessage).toBe('test-message-1') // Verifica por 'id'
    expect(result[1].encryptedMessage).toBe('test-message-2') // Verifica por 'id'
  })

  it('should getAvailableMessageCount of available messages from Redis and MongoDB', async () => {
    const connectionId = 'test-connection-id'

    // Mock Redis response
    jest.spyOn(redisMock, 'llen').mockResolvedValue(5) // Simulate 5 messages in Redis.

    // Mock MongoDB countDocuments response
    storeQueuedMessageMock.countDocuments = jest.fn().mockResolvedValue(3) //Simulate 3 messages in MongoDB.

    const result = await service.getAvailableMessageCount({
      connectionId: 'test-connection-id',
      id: '1',
    })

    expect(result).toBe(8) // 5 messages from Redis + 3 messages from MongoDB
    expect(redisMock.llen).toHaveBeenCalledWith(`connectionId:${connectionId}:queuemessages`)
    expect(storeQueuedMessageMock.countDocuments).toHaveBeenCalledWith({ connectionId })
  })

  it('should addmessage method to the queue and publish it to Redis', async () => {
    // Mock Redis operations
    jest.spyOn(redisMock, 'rpush').mockResolvedValue(1) // Simulate successful push to Redis
    jest.spyOn(redisMock, 'publish').mockResolvedValue(1) // Simulate successful publish to Redis
    jest.spyOn(service, 'getLiveSession').mockResolvedValue(false) // Simulate not being in a live session

    // Mock the method for sending push notifications
    jest.spyOn(service, 'sendPushNotification').mockResolvedValue(true) // Simulate successful push notification

    // Data for the message
    const addMessageDto = {
      id: '1',
      connectionId: 'test-connection-id',
      recipientDids: ['recipient-did'],
      payload: {
        protected: 'string',
        iv: 'string',
        ciphertext: 'string',
        tag: 'string',
      },
      token: 'test-token',
    }

    // Execute the addMessage method
    const result = await service.addMessage(addMessageDto)

    // Verify Redis rpush was called with correct parameters
    expect(redisMock.rpush).toHaveBeenCalledWith(
      `connectionId:${addMessageDto.connectionId}:queuemessages`,
      expect.any(String), // The stringified message data
    )

    // Verify Redis publish was called with correct parameters
    expect(redisMock.publish).toHaveBeenCalledWith(
      addMessageDto.connectionId,
      expect.any(String), // The stringified message data
    )

    // Verify sendPushNotification was called with correct parameters
    expect(service.sendPushNotification).toHaveBeenCalledWith('test-token', expect.any(String))

    // Verify the result contains a messageId
    expect(result).toHaveProperty('messageId')
  })

  it('should remove messages from both Redis and MongoDB', async () => {
    // Mock Redis operations
    jest.spyOn(redisMock, 'lrange').mockResolvedValue([
      JSON.stringify({
        messageId: '1',
        encryptedMessage: 'test-message-1',
        receivedAt: new Date().toISOString(),
      }),
    ])
    // Simulate successful removal from Redis
    jest.spyOn(redisMock, 'lrem').mockResolvedValue(1)

    // Mock MongoDB removal
    storeQueuedMessageMock.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 1 })

    // Data for the message removal
    const removeMessagesDto = {
      id: '1',
      connectionId: 'test-connection-id',
      messageIds: ['1'],
    }

    // Execute the removeMessages method
    await service.removeMessages(removeMessagesDto)

    // Verify Redis lrange was called to find the messages
    expect(redisMock.lrange).toHaveBeenCalledWith(
      `connectionId:${removeMessagesDto.connectionId}:queuemessages`,
      0,
      removeMessagesDto.messageIds.length - 1,
    )

    // Verify Redis lrem was called with the correct parameters
    expect(redisMock.lrem).toHaveBeenCalledWith(
      `connectionId:${removeMessagesDto.connectionId}:queuemessages`,
      1,
      expect.any(String),
    )

    // Verify that messages were removed from MongoDB
    expect(storeQueuedMessageMock.deleteMany).toHaveBeenCalledWith({
      connectionId: removeMessagesDto.connectionId,
      messageId: { $in: removeMessagesDto.messageIds.map((id) => new Object(id)) },
    })
  })
})
