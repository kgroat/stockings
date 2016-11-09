import {connection as WebsocketConnection} from 'websocket';
import {Subscriber, Observable} from 'rxjs/rx';

import {generateRandomId} from './helpers';
import {SocketMessage, serializeMessage} from './socketMessage';
import {makeSubscriberMapObservable, sendMessageIfPrefixed, sendData, complete, iterableForEach, iterableToArray} from './connectionHelpers';

const DATA_PREFIX = 'm:';
const CONTROL_PREFIX = 'c:';

export interface SubscriptionTracker {
  registerSubscription: (connection: StockingsConnection, type: string) => void;
  unregisterSubscription: (connection: StockingsConnection, type: string) => void;
}

export interface Transaction {
  transactionId: string;
  subscriptions: string[];
}

export class StockingsConnection {
  private _connection: WebsocketConnection;
  private _clientId: string;

  private readonly _dataSubscribers: Map<string, Subscriber<SocketMessage<any>>> = new Map();
  private readonly _controlSubscribers: Map<string, Subscriber<SocketMessage<any>>> = new Map();
  private readonly _closeSubscribers: Map<string, Subscriber<void>> = new Map();

  private readonly _subscriptions: Map<string, number> = new Map();
  private readonly _transactions: Map<string, string[]> = new Map();

  private readonly _tracker: SubscriptionTracker;

  constructor(connection: WebsocketConnection, tracker: SubscriptionTracker) {
    this._connection = connection;
    this._clientId = generateRandomId();
    this._tracker = tracker;

    this.dataObservable = makeSubscriberMapObservable(this._dataSubscribers);
    this.controlObservable = makeSubscriberMapObservable(this._controlSubscribers);
    this.closeObservable = makeSubscriberMapObservable(this._closeSubscribers);

    this._connection.on('message', (msg) => {
      var serialData = msg.utf8Data;
      sendMessageIfPrefixed(DATA_PREFIX, serialData, this._dataSubscribers);
      sendMessageIfPrefixed(CONTROL_PREFIX, serialData, this._controlSubscribers);
    });

    this._connection.on('close', (code, desc) => {
      sendData(this._closeSubscribers, undefined);
      complete(this._dataSubscribers);
      complete(this._controlSubscribers);
      complete(this._closeSubscribers);
    });
  }

  readonly dataObservable: Observable<SocketMessage<any>>;

  readonly controlObservable: Observable<SocketMessage<any>>;

  readonly closeObservable: Observable<void>;

  getId(): string {
    return this._clientId;
  }

  getClientAddress(): string {
    return this._connection.remoteAddress;
  }

  generateTransactionId(): string {
    return generateRandomId();
  }

  sendData<T>(type: string, payload: T): void {
    this._connection.send(DATA_PREFIX + serializeMessage(type, payload));
  }

  sendControl<T>(type: string, payload: T): void {
    this._connection.send(CONTROL_PREFIX + serializeMessage(type, payload));
  }

  listenData<T>(type: string): Observable<T> {
    return this.dataObservable.filter(msg => msg.type === type).map(msg => msg.payload);
  }

  listenControl<T>(type: string): Observable<T> {
    return this.controlObservable.filter(msg => msg.type === type).map(msg => msg.payload);
  }

  addSubscription(type: string, transactionId: string): number {
    var transactionSubscriptions = [];
    if(this._transactions.has(transactionId)){
      transactionSubscriptions = this._transactions.get(transactionId);
    }
    var value = 0;
    if(this._subscriptions.has(type)){
      value = this._subscriptions.get(type);
    }

    if(transactionSubscriptions.indexOf(type) >= 0){
      return value;
    }

    if(value === 0){
      this._tracker.registerSubscription(this, type);
    }

    value++;
    this._subscriptions.set(type, value);
    return value;
  }

  removeSubscriptions(transactionId: string): void {
    if(!this._transactions.has(transactionId)){
      return;
    }
    var transactionSubscriptions = this._transactions.get(transactionId);
    transactionSubscriptions.forEach((type) => this._removeSubscription(type));
    this._transactions.delete(transactionId);
  }

  getSubscriptionHeader(transactionId: string): string {
    return JSON.stringify(this._buildTransaction(transactionId));
  }

  getSubscriptions(transactionId: string): string[] {
    return this._transactions.get(transactionId);
  }

  getAllSubscriptions(): string[] {
    return iterableToArray(this._subscriptions.keys())
  }

  addSubscriptionsFrom(other: StockingsConnection): void {
    iterableForEach(other._transactions.keys(), (transactionId) => {
      other._transactions.get(transactionId).forEach((type) => this.addSubscription(type, transactionId));
    });
  }

  close(): void {
    this._connection.close();
    this._connection.clearCloseTimer
  }

  private _removeSubscription(type: string): number {
    if(!this._subscriptions.has(type)){
      return 0;
    }

    var value = this._subscriptions.get(type);
    if(value > 0){
      value--;
    }

    if(value === 0){
      this._tracker.unregisterSubscription(this, type);
    }

    this._subscriptions.set(type, value);
    return value;
  }

  private _buildTransaction(transactionId: string): Transaction {
    return {
      transactionId: transactionId,
      subscriptions: this.getSubscriptions(transactionId)
    }
  }
}