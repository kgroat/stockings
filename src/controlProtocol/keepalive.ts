
import {Observable, Subscription} from 'rxjs/rx';

import {StockingsConnection} from '../stockingsConnection';

const ONE_SECOND = 1000;

export function applyKeepalive(connection: StockingsConnection): Subscription[] {
  var timeoutId: NodeJS.Timer;

  function restartTimer() {
    if(timeoutId){
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      connection.close();
    }, 60 * ONE_SECOND);
  }

  var dataSubscription = connection.dataObservable.subscribe(restartTimer);
  var controlSubscription = connection.controlObservable.subscribe(restartTimer);
  return [dataSubscription, controlSubscription];
}