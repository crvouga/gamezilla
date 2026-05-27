/**
 * App-level re-export of the canonical `KvProvider` from `@pkgs/kv`.
 * Kept as a stable import path for the rest of the app shell; the actual
 * provider (with `KvPlatform` default) lives in the package.
 */
export { KvProvider } from '@pkgs/kv/kv-provider';
