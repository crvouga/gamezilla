import { polyfillCrypto } from './crypto';

export function polyfill() {
  polyfillCrypto();
}
