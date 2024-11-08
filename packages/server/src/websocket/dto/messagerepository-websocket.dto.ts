import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export type EncryptedMessage = {
  protected: string
  iv: string
  ciphertext: string
  tag: string
}

export class ConnectionIdDto {
  @IsNotEmpty()
  id: string

  @IsNotEmpty({ message: 'connectionId is required' })
  connectionId: string
}

export class TakeFromQueueDto {
  @IsNotEmpty()
  id: string

  @IsNotEmpty()
  @IsString()
  connectionId: string

  @IsOptional()
  @IsInt()
  limit?: number

  @IsOptional()
  @IsInt()
  limitBytes?: number

  @IsOptional()
  @IsBoolean()
  deleteMessages?: boolean

  @IsOptional()
  @IsString()
  recipientDid?: string
}

export class AddMessageDto {
  @IsNotEmpty()
  id: string

  @IsNotEmpty()
  connectionId: string

  @IsNotEmpty()
  recipientDids: string[]

  @IsNotEmpty()
  payload: EncryptedMessage

  @IsOptional()
  token: string
}

export class RemoveMessagesDto {
  @IsNotEmpty()
  id: string

  @IsNotEmpty()
  connectionId: string

  @IsNotEmpty()
  messageIds: string[]
}

export class CreateWebsocketDto {}

export class AddLiveSessionDto {
  @IsNotEmpty()
  id: string

  @IsNotEmpty()
  connectionId: string

  @IsNotEmpty()
  sessionId: string
}

export class RemoveAllMessagesDto {
  @IsNotEmpty()
  id: string

  @IsNotEmpty()
  connectionId: string

  @IsNotEmpty()
  @IsString()
  recipientDid: string
}
