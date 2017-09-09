
import { Observable, Subscription } from 'rxjs/Rx'

import { StockingsConnection } from '../stockingsConnection'

const PING_TYPE = 'ping'

const ONE_SECOND = 1000

export function applyPingPong (connection: StockingsConnection): Subscription[] {
  const pingSubscription = Observable.interval(20 * ONE_SECOND).subscribe((i) => {
    connection.sendControl(PING_TYPE, 'ping:' + i.toString(10))
  })
  return [pingSubscription]
}
