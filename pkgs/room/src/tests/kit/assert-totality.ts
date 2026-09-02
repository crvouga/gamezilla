import type {
  RoomCommand,
  RoomCommandPayload,
  RoomEvent,
  RoomModule,
  RoomState,
} from '../../types';

/**
 * M3: every (state, command, identity) yields ok+events or typed error — never throws.
 */
export function assertTotality<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(args: {
  readonly module: RoomModule<S, C, E, string>;
  readonly states: readonly S[];
  readonly actions: readonly RoomCommand<C>[];
  readonly identities: readonly string[];
}): void {
  for (const state of args.states) {
    for (const command of args.actions) {
      for (const identity of args.identities) {
        let result: ReturnType<typeof args.module.handle>;
        try {
          result = args.module.handle(state, command, identity);
        } catch (err: unknown) {
          throw new Error(
            `assertTotality: handle threw identity=${identity} cmd=${command.id}: ${String(err)}`
          );
        }
        if (result.ok && result.events.length === 0) {
          throw new Error(
            `assertTotality: success with empty events cmd=${command.id}`
          );
        }
      }
    }
  }
}
