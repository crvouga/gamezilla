/**
 * Async {@link Kv} `ClientRoomStorage` adapter — works on web (`localStorage`)
 * and React Native (AsyncStorage). The same code path runs in both.
 * Subpath import: `@pkgs/room/client/adapters/storage/key-value`.
 */
export { keyValueRoomClientKeywords } from './keys';
export { KeyValueClientRoomStorage } from './storage';
