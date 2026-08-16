/**
 * In-memory `RoomStorage` adapter — for tests and the loopback testkit.
 * Subpath import: `@pkgs/room/server/adapters/memory`.
 */
export {
  InMemoryRoomStorage,
  type RoomStorageTopicReplace,
  type RoomStorageTopicSnapshot,
} from './storage';
