
import {StockingsServer, StockingsServerOptions, StockingsConnectionRequest} from './src/stockingsServer'
import {StockingsConnection} from './src/stockingsConnection'

export var Server = StockingsServer
export interface ServerOptions extends StockingsServerOptions {}
export interface ConnectionRequest extends StockingsConnectionRequest {}
export var Connection = StockingsConnection
export {MergeStrategy} from './src/stockingsConnection'
