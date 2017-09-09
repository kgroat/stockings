import {connection as WebsocketConnection} from 'websocket'
import {Subscriber, Observable} from 'rxjs/Rx'

import {generateRandomId} from './helpers'
import {SocketMessage, serializeMessage} from './socketMessage'
import {makeSubscriberMapObservable, sendMessageIfPrefixed, sendData, complete, iterableForEach, iterableToArray} from './connectionHelpers'

const DATA_PREFIX = 'm:'
const CONTROL_PREFIX = 'c:'

export type MergeStrategy = 'replace' | 'upsert' | 'append' | 'prepend'

export interface SubscriptionTracker {
  registerSubscription: (connection: StockingsConnection, type: string) => void
  unregisterSubscription: (connection: StockingsConnection, type: string) => void
}

export interface Transaction {
  transactionId: string
  subscriptions: TransactionSubscription[]
}

export interface TransactionSubscription {
  type: string
  mergeStrategy?: MergeStrategy
  upsertKey?: string
}

export class StockingsConnection {
  private _connection: WebsocketConnection
  private _clientId: string

  private readonly _dataSubscribers: Map<string, Subscriber<SocketMessage<any>>> = new Map()
  private readonly _controlSubscribers: Map<string, Subscriber<SocketMessage<any>>> = new Map()
  private readonly _closeSubscribers: Map<string, Subscriber<void>> = new Map()

  private readonly _subscriptions: Map<string, number> = new Map()
  private readonly _transactions: Map<string, TransactionSubscription[]> = new Map()

  private readonly _tracker: SubscriptionTracker

  constructor(connection: WebsocketConnection, tracker: SubscriptionTracker) {
    this._connection = connection
    this._clientId = generateRandomId()
    this._tracker = tracker

    this.dataObservable = makeSubscriberMapObservable(this._dataSubscribers)
    this.controlObservable = makeSubscriberMapObservable(this._controlSubscribers)
    this.closeObservable = makeSubscriberMapObservable(this._closeSubscribers)

    this._connection.on('message', (msg) => {
      var serialData = msg.utf8Data
      sendMessageIfPrefixed(DATA_PREFIX, serialData, this._dataSubscribers)
      sendMessageIfPrefixed(CONTROL_PREFIX, serialData, this._controlSubscribers)
    })

    this._connection.on('close', (code, desc) => {
      sendData(this._closeSubscribers, undefined)
      complete(this._dataSubscribers)
      complete(this._controlSubscribers)
      complete(this._closeSubscribers)
    })
  }

  readonly dataObservable: Observable<SocketMessage<any>>

  readonly controlObservable: Observable<SocketMessage<any>>

  readonly closeObservable: Observable<void>

  getId(): string {
    return this._clientId
  }

  getClientAddress(): string {
    return this._connection.remoteAddress
  }

  generateTransactionId(): string {
    return generateRandomId()
  }

  sendData<T>(type: string, payload: T): void {
    this._connection.send(DATA_PREFIX + serializeMessage(type, payload))
  }

  sendControl<T>(type: string, payload: T): void {
    this._connection.send(CONTROL_PREFIX + serializeMessage(type, payload))
  }

  listenData<T>(type: string): Observable<T> {
    return this.dataObservable.filter(msg => msg.type === type).map(msg => msg.payload)
  }

  listenControl<T>(type: string): Observable<T> {
    return this.controlObservable.filter(msg => msg.type === type).map(msg => msg.payload)
  }

  addSubscription(type: string, transactionId: string, mergeStrategy: MergeStrategy = 'replace'): number {
    var transactionSubscriptions: TransactionSubscription[] = []
    if(this._transactions.has(transactionId)){
      transactionSubscriptions = this._transactions.get(transactionId)
    } else {
      this._transactions.set(transactionId, transactionSubscriptions)
    }
    var value = 0
    if(this._subscriptions.has(type)){
      value = this._subscriptions.get(type)
    }

    if(transactionSubscriptions.find(sub => sub.type == type)){
      return value
    } else {
      transactionSubscriptions.push({ type, mergeStrategy })
    }

    if(value === 0){
      this._tracker.registerSubscription(this, type)
    }

    value++
    this._subscriptions.set(type, value)
    return value
  }

  removeSubscriptions(transactionId: string): void {
    if(!this._transactions.has(transactionId)){
      return
    }
    var transactionSubscriptions = this._transactions.get(transactionId)
    transactionSubscriptions.forEach((sub) => this._removeSubscription(sub.type))
    this._transactions.delete(transactionId)
  }

  getSubscriptionHeader(transactionId: string): string {
    return JSON.stringify(this._buildTransaction(transactionId))
  }

  getSubscriptions(transactionId: string): string[] {
    return this._transactions.get(transactionId).map(sub => sub.type)
  }

  getAllSubscriptions(): string[] {
    return iterableToArray(this._subscriptions.keys())
  }

  addSubscriptionsFrom(other: StockingsConnection): void {
    iterableForEach(other._transactions.keys(), (transactionId) => {
      other._transactions.get(transactionId).forEach((sub) => this.addSubscription(sub.type, transactionId, sub.mergeStrategy))
    })
  }

  close(): void {
    this._connection.close()
    this._connection.clearCloseTimer
  }

  private standardizeMergeStrategyString(mergeStrategyString: string): string {
    var parameters = getParamNamesFromFunctionString(mergeStrategyString)
    if(parameters.length !== 2){
      throw new Error(`Invalid merge strategy.  Should have 2 parameters instead had ${parameters.length}`)
    }

    var body = getBodyFromFunctionString(mergeStrategyString)

    return `(${parameters[0]},${parameters[1]})=>{${body}}`
  }

  private convertMergeStrategyToString(mergeStrategy: (a, b) => any): string {
    return this.standardizeMergeStrategyString(getUncommentedFunctionString(mergeStrategy))
  }

  private _removeSubscription(type: string): number {
    if(!this._subscriptions.has(type)){
      return 0
    }

    var value = this._subscriptions.get(type)
    if(value > 0){
      value--
    }

    if(value === 0){
      this._tracker.unregisterSubscription(this, type)
    }

    this._subscriptions.set(type, value)
    return value
  }

  private _buildTransaction(transactionId: string): Transaction {
    return {
      transactionId: transactionId,
      subscriptions: this._transactions.get(transactionId)
    }
  }
}


var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg
var ARGUMENT_NAMES = /([^\s,]+)/g
function getUncommentedFunctionString(func: (a, b) => any): string {
  return func.toString().replace(STRIP_COMMENTS, '')
}
function getParamNamesFromFunctionString(fnStr: string): string[] {
  var result = fnStr.slice(fnStr.indexOf('(')+1, fnStr.indexOf(')')).match(ARGUMENT_NAMES)
  if(result === null)
    result = []
  return result
}
function getBodyFromFunctionString(fnStr: string): string {
  if(fnStr.indexOf('{') > 0){
    return fnStr.slice(fnStr.indexOf('{')+1, fnStr.lastIndexOf('}')).trim()
  } else {
    return `return ${fnStr.substring(fnStr.indexOf('=>')).trim()}`
  }
}
