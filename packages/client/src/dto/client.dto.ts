import { IsNotEmpty } from 'class-validator'

export class ConnectionIdDto {
  @IsNotEmpty({ message: 'connectionId is required' })
  connectionId: string
}

export class AddLiveSessionDto {
  @IsNotEmpty({ message: 'connectionId is required' })
  connectionId: string

  @IsNotEmpty({ message: 'sessionId is required' })
  sessionId: string
}
