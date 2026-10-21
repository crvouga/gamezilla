import type {
  RoomCommandPayload,
  RoomEvent,
  RoomModule,
  RoomState,
} from '@pkgs/room-root-shared-ts/types';

/**
 * M2: rebuild each state with shuffled key insertion order; hashes must match.
 */
export function assertHashCanonical<
  S extends RoomState,
  C extends RoomCommandPayload = RoomCommandPayload,
  E extends RoomEvent = RoomEvent,
>(module: RoomModule<S, C, E, string>, states: readonly S[]): void {
  for (const state of states) {
    const expected = module.hash(state);
    const keys = Object.keys(state);
    const shuffled: Record<string, unknown> = {};
    for (let i = keys.length - 1; i >= 0; i -= 1) {
      const k = keys[i]!;
      shuffled[k] = (state as Record<string, unknown>)[k];
    }
    const rebuilt = shuffled as S;
    const actual = module.hash(rebuilt);
    if (actual !== expected) {
      throw new Error(
        `assertHashCanonical: hash depends on key order expected=${expected} actual=${actual}`
      );
    }
  }
}
