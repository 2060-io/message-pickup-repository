import { ArgumentsHost, Catch, HttpException } from '@nestjs/common'
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets'
import { Logger } from '@nestjs/common'

@Catch(WsException, HttpException)
export class WebsocketExceptionsFilter extends BaseWsExceptionFilter {
  private logger: Logger
  constructor() {
    super()
    this.logger = new Logger()
  }
  catch(exception: WsException | HttpException, host: ArgumentsHost) {
    const client = host.switchToWs().getClient() as WebSocket
    const data = host.switchToWs().getData()
    const event = host.switchToWs().getPattern()
    const error = exception instanceof WsException ? exception.getError() : exception.getResponse()
    const details = error instanceof Object ? { ...error } : { message: error }
    this.logger.debug(`[WsExecption] Error with ${event} to ${JSON.stringify(details)}`)
    client.send(
      JSON.stringify({
        event: 'error',
        data: {
          id: (client as any).id,
          rid: data.rid,
          ...details,
        },
      }),
    )
  }
}
