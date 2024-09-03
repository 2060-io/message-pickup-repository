import { IoAdapter } from '@nestjs/platform-socket.io'
import { INestApplication, Injectable } from '@nestjs/common'
import { Server } from 'ws'

@Injectable()
export class WsAdapter extends IoAdapter {
  constructor(private app: INestApplication) {
    super(app)
  }

  create(port: number, options?: any): any {
    return new Server({ port, ...options })
  }
}
