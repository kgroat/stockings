import {server as WebSocketServer, request as ConnectionRequest} from 'websocket';
import {Server as HttpServer} from 'http';
import {Observable} from 'rxjs/Rx';

import {StockingsConnection, SubscriptionTracker} from './stockingsConnection';
import {makeEncoder, makeDecoder, TokenPayload, isAlgorithmAsymmetric} from './tokenHelpers';
import {valueOrDefault} from './helpers';
import {iterableForEach} from './connectionHelpers';

import {applyProtocol} from './controlProtocol';

const CLIENT_TOKEN_TYPE = 'client-token';

const ONE_SECOND = 1000;
const ONE_MINUTE = 60 * ONE_SECOND;
const HALF_HOUR = 30 * ONE_MINUTE;

export interface StockingsConnectionRequest extends ConnectionRequest {}

export interface StockingsServerOptions {
  server: HttpServer;
  privateKey: string;
  publicKey?: string;
  requestFilter?: (req: StockingsConnectionRequest) => boolean;
  algorithm?: string;
  disposeMetaAfter?: number;
}

const STOCKINGS_PROTOCOL = 'stockings';

export class StockingsServer implements SubscriptionTracker {
  private _socketServer: WebSocketServer;
  private _server: HttpServer;
  private _encoder: (id: string, addr: string) => Promise<string>;
  private _decoder: (token: string) => Promise<TokenPayload>;
  private _acceptRequest: (req: StockingsConnectionRequest) => boolean = (req) => true;
  private _connections: Map<string, StockingsConnection> = new Map();
  private _connectionsBySubscription: Map<string, Map<string, StockingsConnection>> = new Map();

  constructor(options: StockingsServerOptions) {
    this._server = options.server;
    this._socketServer = new WebSocketServer({
      httpServer: this._server,
      autoAcceptConnections: false,
      keepalive: false
    });

    var algorithm = valueOrDefault(options.algorithm, 'HS256');
    if(isAlgorithmAsymmetric(algorithm) && (!options.privateKey || !options.publicKey)){
      throw new Error('For asymmetric encryption algorithm ' + algorithm + ', both privateKey and publicKey properties are required.');
    } else if(!options.privateKey) {
      throw new Error('For encryption algorithm ' + algorithm + ', privateKey property is required.');
    }

    var privateKey = options.privateKey;
    var decryptionKey = isAlgorithmAsymmetric(algorithm) ? options.publicKey : privateKey;

    this._encoder = makeEncoder(algorithm, privateKey);
    this._decoder = makeDecoder(algorithm, decryptionKey);

    if(typeof options.requestFilter === 'function'){
      this._acceptRequest = options.requestFilter;
    }

    var disposeMetaAfter = valueOrDefault(options.disposeMetaAfter, HALF_HOUR);

    this._socketServer.on('request', (req) => {
      if(!hasStockingsProtocol(req) || !this._acceptRequest(req)){
        req.reject();
        return;
      }

      var connection = new StockingsConnection(req.accept(STOCKINGS_PROTOCOL), this);
      applyProtocol({
        connection: connection,
        tokenEncoder: this._encoder,
        getConnection: (token) => this.getConnection(token, connection.getClientAddress())
      });
      this._connections.set(connection.getId(), connection);
      var disposeMetaSubscription = connection.closeObservable.delay(disposeMetaAfter).subscribe(() => {
        this._connections.delete(connection.getId());
        connection.getAllSubscriptions().forEach((type) => {
          this.unregisterSubscription(connection, type);
        });
        disposeMetaSubscription.unsubscribe();
      });
    });
  }

  getConnection(token: string, address: string): Promise<StockingsConnection> {
    return this._decoder(token).then((payload) => {
      var connection = this._connections.get(payload.clientId);
      if(address !== payload.address){
        if(connection){
          connection.close();
        }
        return Promise.reject<StockingsConnection>(new Error('IP address mismatch'));
      }
      return connection;
    });
  }

  sendData<T>(type: string, payload: T, cb?: (err?: any) => void): void {
    if(!this._connectionsBySubscription.has(type)){
      return;
    }
    setImmediate(() => {
      var subscribers = this._connectionsBySubscription.get(type);
      iterableForEach(subscribers.values(), (connection) => {
        connection.sendData(type, payload);
      });
      if(typeof cb === 'function'){
        cb();
      }
    });
  }

  registerSubscription(connection: StockingsConnection, type: string) {
    var connections: Map<string, StockingsConnection>;
    if(this._connectionsBySubscription.has(type)){
      connections = this._connectionsBySubscription.get(type);
    } else {
      connections = new Map();
      this._connectionsBySubscription.set(type, connections);
    }
    
    connections.set(connection.getId(), connection);
  }

  unregisterSubscription(connection: StockingsConnection, type: string) {
    if(!this._connectionsBySubscription.has(type)){
      return;
    }
    var connections = this._connectionsBySubscription.get(type);
    connections.delete(connection.getId());
  }
}

function hasStockingsProtocol(req: StockingsConnectionRequest): boolean {
  return req.requestedProtocols.map(p => p.toLowerCase()).indexOf(STOCKINGS_PROTOCOL) > -1;
}