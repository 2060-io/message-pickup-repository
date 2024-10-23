import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { MongooseModule } from '@nestjs/mongoose'
import { ConfigModule } from '@nestjs/config'
import appConfig from '../src/config/app.config'
import { Client } from 'rpc-websockets'
import { MockRedisModule } from './mock-redis.module'
import { Redis } from 'ioredis'
import { WebsocketTestModule } from './WebsocketTestModule'

describe('WebSocket Connection (e2e)', () => {
  let app: INestApplication
  let mongod: MongoMemoryServer
  let client: Client
  let redisMock: Redis

  beforeAll(async () => {
    // Create an in-memory MongoDB instance
    mongod = await MongoMemoryServer.create()
    const uri = mongod.getUri()

    // Create a testing module with the WebsocketModule and MongooseModule
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        WebsocketTestModule,
        ConfigModule.forRoot({
          envFilePath: '.env',
          load: [appConfig],
          isGlobal: true,
        }),
        MongooseModule.forRoot(uri),
        MockRedisModule,
      ],
    }).compile()

    // Initialize the NestJS application
    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(new ValidationPipe())
    await app.init()
    await app.listen(3500)
  })

  afterAll(async () => {
    // Close the Redis connection
    if (redisMock) {
      await redisMock.quit()
    }
    // Ensure all async operations are completed
    if (app) {
      await app.close()
    }
    // Stop the in-memory MongoDB instance
    if (mongod) {
      await mongod.stop()
    }
  })

  it('should connect to the WebSocket server and call ping', (done) => {
    // Initialize the WebSocket client
    client = new Client('ws://localhost:3100')

    client.on('open', async () => {
      try {
        // Call the addLiveSession method
        const response = await client.call('ping')

        expect(response).toBeDefined()
        expect(response).toBe('pong')
        console.log('*** e2e test: Successfully called addLiveSession ***')
        client.close()
        done()
      } catch (error) {
        client.close()
        done.fail(`Failed to call ping: ${error.message}`)
      }
    })

    client.on('error', (error) => {
      console.error('Connection failed:', error)
      done.fail('Failed to connect to the WebSocket server')
    })
  }, 5000)
})
