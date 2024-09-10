import { Test, TestingModule } from '@nestjs/testing'
import { WebsocketService } from './websocket.service'
import { HandledRedisModule } from '../modules/redis.module'
import { HandledMongooseModule } from '../modules/mongo.module'
import { ConfigModule } from '@nestjs/config'
import appConfig from '../config/app.config'

describe('WebsocketService', () => {
  let service: WebsocketService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        // Utiliza los mismos módulos que configuras en AppModule
        ConfigModule.forRoot({
          envFilePath: '.env', // Considera usar un archivo .env específico para pruebas
          load: [appConfig],
          isGlobal: true,
        }),
        HandledMongooseModule, // Asegúrate de que este módulo expone correctamente los modelos
        HandledRedisModule, // Asegúrate de que este módulo expone correctamente la instancia de Redis
      ],
      providers: [
        WebsocketService,
        // No es necesario agregar aquí los módulos como providers si ya están importados
      ],
    }).compile()

    service = module.get<WebsocketService>(WebsocketService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
