
import {Observable, Subscription} from 'rxjs/Rx';

import {StockingsConnection} from '../stockingsConnection';

const TRANSFER_TYPE = 'client-change';

export function applyTransfer(connection: StockingsConnection, getConnection: (token: string) => Promise<StockingsConnection>): Subscription[] {
  var transferSubscription = connection.listenControl<string>(TRANSFER_TYPE).subscribe((token) => {
    getConnection(token).then((oldConnection) => {
      if(oldConnection){
        connection.addSubscriptionsFrom(oldConnection);
      }
    }, (err) => {
      connection.close();
    });
  });
  
  return [transferSubscription];
}