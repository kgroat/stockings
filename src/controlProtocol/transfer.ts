
import { Subscription } from 'rxjs/Rx'

import { StockingsConnection } from '../stockingsConnection'

const TRANSFER_TYPE = 'client-change'

export function applyTransfer (connection: StockingsConnection, getConnection: (token: string) => Promise<StockingsConnection>): Subscription[] {
  const transferSubscription = connection.listenControl<string>(TRANSFER_TYPE).subscribe((token) => {
    getConnection(token).then((oldConnection) => {
      if (oldConnection) {
        connection.addSubscriptionsFrom(oldConnection)
      }
    }).catch(() => {
      connection.close()
    })
  })

  return [transferSubscription]
}
