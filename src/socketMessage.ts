export interface SocketMessage<T> {
  type: string
  payload: T
}

export function deserializeMessage<T> (message: string, mapper?: (data: any) => T): SocketMessage<T> {
  let parsed
  try {
    parsed = JSON.parse(message)
  } catch (e) {
    return null
  }
  if (typeof parsed !== 'object') {
    return null
  }
  return {
    type: parsed.type,
    payload: typeof mapper === 'function' ? mapper(parsed.payload) : parsed.payload
  }
}

export function serializeMessage (type: string, payload: any): string {
  return JSON.stringify(makeMessage(type, payload))
}

/* ----- PRIVATE ----- */

function makeMessage<T> (type: string, payload: any): SocketMessage<T> {
  return {
    type: type,
    payload: payload
  }
}
