import { NestFactory } from '@nestjs/core'
import { ClientModule } from './client.module'
export { ClientModule } from './client.module'
export { MessagePickupRepositoryClient } from './client/MessagePickupRepositoryClient'

async function bootstrap() {
  const app = await NestFactory.create(ClientModule)
  await app.listen(3000)
}
bootstrap()
