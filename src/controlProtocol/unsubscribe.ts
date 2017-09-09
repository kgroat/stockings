
import { Subscription } from 'rxjs/Rx'

import { StockingsConnection } from '../stockingsConnection'

const UNSUBSCRIBE_TYPE = 'unsubscribe'

export function applyUnsubscribe (connection: StockingsConnection): Subscription[] {
  const unsubscribeSubscription = connection.listenControl<string>(UNSUBSCRIBE_TYPE).subscribe((transactionId) => {
    connection.removeSubscriptions(transactionId)
    connection.sendControl(UNSUBSCRIBE_TYPE, transactionId)
  })

  return [unsubscribeSubscription]
}
