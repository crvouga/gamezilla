import { polyfillBuffer } from './buffer';
import { polyfillCrypto } from './crypto';

export function polyfill() {
  polyfillBuffer();
  polyfillCrypto();
}
