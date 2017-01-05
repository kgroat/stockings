
import {Observable, Subscription} from 'rxjs/Rx';

import {StockingsConnection} from '../stockingsConnection';

import {applyKeepalive} from './keepalive';
import {applyPingPong} from './pingPong';
import {applyToken} from './token';
import {applyTransfer} from './transfer';
import {applyUnsubscribe} from './unsubscribe';

export interface ProtocolOptions {
  connection: StockingsConnection;
  tokenEncoder: (id: string, addr: string) => Promise<string>;
  getConnection: (token: string) => Promise<StockingsConnection>;
}

export function applyProtocol(options: ProtocolOptions){
  var protocolOverhead: (Subscription[]|Observable<Subscription>)[] = [];
  protocolOverhead.push(applyKeepalive(options.connection));
  protocolOverhead.push(applyPingPong(options.connection));
  protocolOverhead.push(applyToken(options.connection, options.tokenEncoder));
  protocolOverhead.push(applyTransfer(options.connection, options.getConnection));
  protocolOverhead.push(applyUnsubscribe(options.connection));
  protocolOverhead.push([options.connection.closeObservable.subscribe(() => {
    protocolOverhead.forEach(list => (<Subscription[]>list).forEach((sub) => sub.unsubscribe()));
  })]);
}