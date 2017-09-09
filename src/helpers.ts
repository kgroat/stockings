
function generateRandomHexCharacter(): string {
  return Math.floor(Math.random() * 16).toString(16)
}

export function generateRandomId(): string {
  var output = ''
  for(var i=0 i<16 i++){
    output += generateRandomHexCharacter()
  }
  return output
}

export function valueOrDefault<T>(value: T, defaultValue: T, check?: (val: T) => boolean): T {
  if(typeof check !== 'function'){
    check = (val) => val != null
  }
  return check(value) ? value : defaultValue
}