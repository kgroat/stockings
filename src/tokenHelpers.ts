import * as jwt from 'jsonwebtoken';

export interface TokenPayload {
  clientId: string;
  address: string;
}

export function makeDecoder(algorithm: string, decryptionKey: string){
  return function decode(clientToken: string): Promise<TokenPayload> {
    return new Promise<TokenPayload>((res, rej) => {
      if(clientToken){
        jwt.verify(clientToken, decryptionKey, { algorithms: [algorithm], ignoreExpiration: true, subject: 'stockings' }, function(err: any, decoded: TokenPayload){
          if(err){
            return rej(err);
          }
          if(!decoded || !decoded.clientId || !decoded.address){
            return rej('Malformed client token');
          }
          res(decoded);
        });
      } else {
        res(null);
      }
    });
  }
}

export function makeEncoder(algorithm: string, encryptionKey: string) {
  return function encode(clientId: string, address: string): Promise<string> {
    return new Promise<string>((res, rej) => {
      if(clientId === null || clientId === undefined){
        return rej('Parameter clientId was not supplied correctly.');
      }
      let payload: TokenPayload = {
        clientId: clientId,
        address: address
      };
      jwt.sign(payload, encryptionKey, { algorithm: algorithm, expiresIn: '30m', subject: 'stockings' }, (err, data) => {
        if(err){
          return rej(err);
        }
        res(data);
      });
    });
  }
}

export function isAlgorithmAsymmetric(algorithm: string){
  return algorithm.toUpperCase().indexOf('RS') === 0;
}