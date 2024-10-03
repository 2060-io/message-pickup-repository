import { IsNotEmpty, IsString } from 'class-validator'

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

export class RemoveAllMessagesDto {
  @IsNotEmpty()
  connectionId: string

  @IsNotEmpty()
  @IsString()
  recipientDid: string
}
