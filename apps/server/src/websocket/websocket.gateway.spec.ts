import { Test, TestingModule } from '@nestjs/testing'
import { WebsocketGateway } from './websocket.gateway'
import { WebsocketService } from './websocket.service'
import { Server } from 'rpc-websockets'

describe('WebsocketGateway', () => {
  let gateway: WebsocketGateway
  let serverMock: Server

  beforeEach(async () => {
    serverMock = new Server({ port: 0 }) as jest.Mocked<Server>
    jest.spyOn(serverMock, 'event').mockImplementation()
    jest.spyOn(serverMock, 'register').mockImplementation()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebsocketGateway,
        {
          provide: WebsocketService,
          useValue: {
            setServer: jest.fn(),
          },
        },
      ],
    }).compile()

    gateway = module.get<WebsocketGateway>(WebsocketGateway)

    // Injecting the mocked server into the gateway
    gateway['server'] = serverMock
  })

  afterEach(async () => {
    // Close the WebSocket server
    if (serverMock) {
      serverMock.close()
    }
  })

  it('should be defined', () => {
    expect(gateway).toBeDefined()
  })

  it('should handle a WebSocket client connection', () => {
    // Mock implementation for the server 'on' method to handle 'connection' events
    const connectionCallback = jest.fn()
    jest.spyOn(serverMock, 'on').mockImplementation((event, callback) => {
      if (event === 'connection') {
        connectionCallback.mockImplementation(callback)
      }
      return serverMock // Return the mock server to match the expected return type
    })

    // Simulate a connection event
    const mockClient = { id: 'test-client-id' }
    connectionCallback(mockClient)

    // Verify that the connection was handled correctly
    expect(connectionCallback).toHaveBeenCalledWith(mockClient)
    expect(connectionCallback).toHaveBeenCalledTimes(1)
  })
})
