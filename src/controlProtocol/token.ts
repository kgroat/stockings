
import {Observable, Subscription} from 'rxjs/Rx'

import {StockingsConnection} from '../stockingsConnection'

const CLIENT_TOKEN_TYPE = 'client-token'

const ONE_SECOND = 1000

const MAX_TRIES = 12

export function applyToken(connection: StockingsConnection, encoder: (id: string, addr: string) => Promise<string>): Observable<Subscription> {
  return Observable.fromPromise<Subscription[]>(encoder(connection.getId(), connection.getClientAddress()).then((token) => {
    connection.sendControl(CLIENT_TOKEN_TYPE, token)

    var sendTokenSubscription = Observable.timer(0, 20 * ONE_SECOND).subscribe((i) => {
      if(i >= MAX_TRIES){
        connection.close()
        return
      }
      connection.sendControl(CLIENT_TOKEN_TYPE, token)
    })

    var getTokenSubscription = connection.listenControl<string>(CLIENT_TOKEN_TYPE).subscribe((receivedToken) => {
      if(receivedToken != token){
        connection.close()
      }
      sendTokenSubscription.unsubscribe()
    })

    return [sendTokenSubscription, getTokenSubscription]
  })).flatMap((subs) => subs)
}