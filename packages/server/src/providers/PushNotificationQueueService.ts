import { Injectable, Logger } from '@nestjs/common'
import { BehaviorSubject, EMPTY, Observable, timer } from 'rxjs'
import { map, tap } from 'rxjs/operators'

interface QueueItem {
  token: string
  messageId: string
}

@Injectable()
export class PushNotificationQueueService {
  private readonly logger = new Logger(PushNotificationQueueService.name)
  private queue: { [token: string]: BehaviorSubject<QueueItem> } = {}

  addToQueue(token: string, messageId: string): Observable<void> {
    if (!this.queue[token]) {
      const subject = new BehaviorSubject<QueueItem>({ token, messageId })
      this.queue[token] = subject

      timer(5000) // 5 seconds delay token on queue
        .subscribe(() => {
          delete this.queue[token]
          subject.complete()
        })

      return this.queue[token].pipe(
        tap(() => this.logger.debug(`[addToQueue] return token: ${token} with MessageId ${messageId}`)),
        map(() => undefined),
      )
    } else {
      this.logger.debug(`[addToQueue] Token is already in the queue. Ignoring the request.`)
      return EMPTY
    }
  }

  isTokenInQueue(token: string): boolean {
    return !!this.queue[token]
  }
}
