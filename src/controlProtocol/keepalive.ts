
import { Subscription } from 'rxjs/Rx'

import { StockingsConnection } from '../stockingsConnection'

const ONE_SECOND = 1000

export function applyKeepalive (connection: StockingsConnection): Subscription[] {
  let timeoutId: NodeJS.Timer

  function restartTimer () {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      connection.close()
    }, 60 * ONE_SECOND)
  }

  const dataSubscription = connection.dataObservable.subscribe(restartTimer)
  const controlSubscription = connection.controlObservable.subscribe(restartTimer)
  return [dataSubscription, controlSubscription]
}
