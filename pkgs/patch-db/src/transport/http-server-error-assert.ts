import { isDevBuild } from '@pkgs/assert';

/** True when HTTP 500 responses should crash via the assert handler chain. */
export function shouldAssertOnPatchDbHttpServerError(): boolean {
  if (!isDevBuild()) return false;
  if (typeof process !== 'undefined') {
    const env = process.env?.NODE_ENV;
    if (env === 'test') return false;
  }
  return true;
}
