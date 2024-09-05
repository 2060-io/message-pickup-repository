import { Module } from '@nestjs/common'
import { MessagePickupRepositoryClient } from './client/MessagePickupRepositoryClient'

@Module({
  imports: [],
  controllers: [],
  providers: [MessagePickupRepositoryClient],
})
export class ClientModule {}
