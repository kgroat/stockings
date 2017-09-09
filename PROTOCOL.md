# Stockings communication protocol
This document outlines the general communication protocol for the Stockings framework

## Communication format
### Data-carrying messages
Data-carrying messages sent via the websocket have two parts, the prefix and the body.
The prefix is always just two characters, `'m:'`.  This prefix is used to differentiate between data-carrying messages and messages of other kinds.
The body is the rest of the message, and takes the form of a valid JSON string.  The body -- when deserialized -- should have two properties: type and payload.
The type property should be a string denoting what kind of message was being communicated, while payload can be any valid JSON object.

A valid data-carrying message might look like the following:
```
m:{"type":"user:603a8d201a95f54c43f1b361","payload":{"_id":"603a8d201a95f54c43f1b361","avatar":"https://s.gravatar.com/avatar/30f0a7a1c9bd639b4c4c17158ad4c301"}}
```

### Control messages
Control messages sent via the websocket also have two parts, the prefix and the body.
Unlike data-carrying messages, the prefix is always `'c:'`.  This prefix is used to differentiate between control messages and messages of other kinds.
The body of a control message takes the same form as that of the body of a data-carrying message.

A valid control message might look like the following:
```
c:{"type":"client-token","payload":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2p3dC1pZHAuZXhhbXBsZS5jb20iLCJzdWIiOiJtYWlsdG86bWlrZUBleGFtcGxlLmNvbSIsIm5iZiI6MTQ3ODI0MzAzNSwiZXhwIjoxNDc4MjQ2NjM1LCJpYXQiOjE0NzgyNDMwMzUsImp0aSI6ImlkMTIzNDU2IiwidHlwIjoiaHR0cHM6Ly9leGFtcGxlLmNvbS9yZWdpc3RlciJ9.my4qsfrr1UuNtzL7W-SsyjLRnTqAMKiBaWpGQ2BnXlc"}
```

## Steps for communication
### 1. Establish websocket connection
A websocket connection is made with the server using protocol name `'stockings'` so that the client can have a streaming communication with the server.

#### (a) Server generates socket JWT
Upon websocket connection, the server generates a socket JWT that it can use to uniquely identify the websocket connection on its end.  In the JWT, the server also stores the IP address with which the connection was made.  This socket JWT is then sent to the client as the payload of a control message of type `'client-token'`.

#### (b) Client responds
Upon receiving the `'client-token'` control message, the socket JWT is stored by the client and then the client responds with a `'client-token'` control message with the same JWT as the payload.

#### (c) Control message retry
If the server does not receive a `'client-token'` response within 5 seconds of sending the previous `'client-token'` control message, the same message is re-sent to the client.

#### (d) Connection severing
If the server tries to send the `'client-token'` control message 6 times without response, it may forcibly sever the connection.
In addition, if the server receives a `'client-token'` response from a client with a JWT that is not identical to the one sent, it may forcibly sever the connection.

#### (e) Connection fault retry
If a client attempts to connect and does not receive a `'client-token'` message within 30 seconds of the attempt, it may forcibly sever the connection and retry.


### 2. Making http requests
The client can be used to make http requests.

#### (a) Request Observables
The client communicates with its surrounding code using [RxJS Obervables](https://github.com/Reactive-Extensions/RxJS/blob/master/doc/api/core/observable.md) and [RxJS Disposables](https://github.com/Reactive-Extensions/RxJS/blob/master/doc/api/disposables/disposable.md).

#### (b) Subscriber handling
The client generates a Disposable from each Subscriber making an http request through an Observable.  Each Disposable may be assigned its own unique transaction id (see [Section 3.b](#b-automatic-subscription)) by the server to track the subscriptions the originating http request created.

#### (c) Disposal
When a Disposable is disposed for any reason, if it had an associated transaction id, the client shall send an `'unsubscribe'` control message with a payload of the given transaction id.

#### (d) Server response
When the server receives an `'unsubscribe'` control message, it should immediately remove all subscriptions associated with the given transaction id from the websocket connection.
Once this is done, or if no subscriptions are associated with the transaction id, the server shall respond over the websocket connection with an `'unsubscribe'` control message containing the same transaction id.

#### (e) Disposal message retry
If the client does not receive an `'unsubscribe'` control message response from the server within 5 seconds of sending the previous `'unsubscribe'` message, it may re-send the same `'unsubscribe'` message again.

#### (f) Connection severing
If the client tries to send the `'unsubscribe'` control message 12 times without response, it may forcibly sever the connection.


### 3. Subscribing during http requests
When the client makes an http request, the server may automatically subscribe the client to one or many data-carrying message types.

#### (a) Socket authentication
As a part of the http request, the `'client-token'` header should contain the socket JWT generated during establishing of the websocket connection.
If the `'client-token'` header is supplied but does not identify any websocket connections the server is tracking, or if the IP address in the token does not match the requestor's IP, it is treated as though the `'client-token'` header was not supplied at all.
In the event that there is an IP mismatch, if a websocket connection was identified by it, the connection is forcibly closed, to protect against improper and insecure use.

#### (b) Automatic subscription
During the processing of the http request, if the `'client-token'` header was correctly supplied, the server may decide that the client should be subscribed to a set of data-carrying message types.
If this happens, the websocket connection identified by the token in the `'client-token'` header will have the subscription(s) added to it for the given data-carrying message types.
In addition, a unique transaction id should be generated to identify the set of subscriptions being added as a part of the http request.

#### (c) Communicating subscriptions
If subscriptions are created as a part of an http request, the server's response shall contain the `'client-subscriptions'` header.  This header will contain a JSON string for an object with two properties: `transactionId` and `subscriptions`.
The `transactionId` property should contain the unique transaction id generated to identify the subscriptions, and the `subscriptions` property should be an array of Subscription objects.
A Subscription object has two properties: `type`, containing the data-carrying message types for which subscription was created and `mergeStrategy`, an optional string property which defines how each object that comes through the subscription is merged into the original response from the server.

#### (d) Merge strategies
If a Subscription object contains a `'mergeStrategy'` string, then it should be one of the following values: `'replace', 'append', 'prepend', or 'upsert'`.  If it is `'upsert'`, then the Subscription object should also contain an `'upsertKey'` string, defining the property by which two objects should be considered similar for the purposes of inserting or updating.

### 4. Sending messages during http requests
During the processing of an http request, the server may decide to send messages to all clients with subscriptions to a particular type of data-carrying message.

#### (a) Message deferral
If the server wants to send data to clients, it may choose to wait until the http request is done processing before sending the data-carrying messages to the subscribed websocket connections.

#### (b) Subscription lookup
The server shall only send data-carrying messages through websocket connections with an active subscription to the data-carrying message type specified during the http request.

#### (c) Message receipt
When a client receives a data-carrying message through its websocket connection, it shall determine which Subscriber(s) are subscribed to the message type, and can transform the data and send the data through the Observable to the Subscriber.


### 5. Keep alive
The connection between a client and server is validated not only using the above methods, but also utilizes a ping-pong scheme

#### (a) Ping
The server will send a `'ping'` control message every 20 seconds.  This message may contain any payload the server chooses, but should remain smaller than 1000 characters in length when serialized.

#### (b) Pong
Whenever a client receives a `'ping'` control message, it will respond with its own `'pong'` control message, sending exactly the same payload as it received back to the server.

#### (c) Server failure
If a server fails to receive any messages (data-carrying or control) from a client for more than 60 seconds, it should forcibly sever the connection.

#### (d) Client failure
If a client fails to receive any messages (data-carrying or control) for more than 60 seconds, it should forcibly close the connection and attempt to reconnect.


### 6. Subscription transfer
If the connection between the client and server is ever lost, the client may attempt to create a new connection.

#### (a) Attempting subscription transfer
When a new connection is established, after the client has received its new socket JWT, it may send its old socket JWT to the server via a `'client-change'` control message.

#### (b) Responding to subscription transfer
If a server receives a `'client-change'` control message, it may attempt to transfer any active subscriptions and associated transaction ids related to the websocket connection specified by the old JWT to the new websocket connection.
The server should only honor these requests if made from the same IP that the original token was registered to, to protect against subscription hijacking.
If the server does this, it shall send a `'client-change'` control message back over the websocket connection with the same JWT as was sent to it.

#### (c) Subscription transfer retry
If the client does not receive a `'client-change'` control message within 5 seconds of sending the previous `'client-change'` control message, it may re-send the same `'client-change'` message again.

#### (d) Retry fault
If the client tries to send the `'client-change'` control message 12 times without response, the connection should be retained, but no further `'client-change'` attempts should be made over the same connection.
