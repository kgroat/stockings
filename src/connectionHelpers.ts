import {Observable, Subscriber} from 'rxjs/rx';

import {SocketMessage, deserializeMessage} from './socketMessage';

import {generateRandomId} from './helpers';

export function makeSubscriberMapObservable<T>(subscribers: Map<string, Subscriber<T>>): Observable<T> {
  return new Observable<T>((sub: Subscriber<T>) => {
    var id = generateRandomId();
    subscribers.set(id, sub);

    return () => {
      subscribers.delete(id);
    };
  });
}

export function complete<T>(subscribers: Map<string, Subscriber<T>>) {
  iterableForEach(subscribers.values(), (sub) => sub.complete());
}

export function sendData<T>(subscribers: Map<string, Subscriber<T>>, data: T) {
  iterableForEach(subscribers.values(), (sub) => sub.next(data));
}

export function sendMessageIfPrefixed<T>(prefix: string, serialData: string, subscribers: Map<string, Subscriber<SocketMessage<T>>>){
  if(hasPrefix(prefix, serialData)){
    var message = deserializeMessage(serialData.substring(prefix.length).trim());
    if(message){
      sendData(subscribers, message);
    }
  }
}

export function iterableForEach<T>(iterator: IterableIterator<T>, process: (item: T) => void) {
  var { done, value } = iterator.next();
  while(!done){
    process(value);
    let item = iterator.next();
    done = item.done;
    value = item.value;
  }
}

export function iterableToArray<T>(iterator: IterableIterator<T>): T[] {
  var output: T[] = [];
  iterableForEach(iterator, (item) => output.push(item));
  return output;
}



function hasPrefix(prefix: string, data: string): boolean {
  for(var i=0; i<prefix.length; i++){
    if(data[i] !== prefix[i]){
      return false;
    }
  }
  return true;
}