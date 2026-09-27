/**
 * Async {@link Kv} `ClientRoomStorage` adapter — works on web (`localStorage`)
 * and in a non-DOM key-value store. The same code path runs in both.
 * Subpath import: `@pkgs/room/client/adapters/storage/key-value`.
 */
export { committedSegmentKeyword, keyValueRoomClientKeywords } from './keys';
export { KeyValueClientRoomStorage } from './storage';
