import { Assert } from '@pkgs/assert-root-shared-ts/assert';
import { isMessageEnvelope } from '@pkgs/message-shared-ts/message';
import type {
  LogEntry,
  RoomActor,
  RoomEvent,
} from '@pkgs/room-root-shared-ts/types';

const crash: Assert = Assert.crash();

/** The one committed batch shape, validated before persistence or reduction. */
export function committedRoomEntries<E extends RoomEvent>(args: {
  readonly events: readonly E[];
  readonly base: number;
  readonly actor: RoomActor;
  readonly ts: number;
}): LogEntry<E>[] {
  crash.ok(args.events.length > 0, 'handle must produce events on success');
  return args.events.map((event, index) => {
    crash.ok(
      isMessageEnvelope(event),
      'Tiger: room events must be Message envelopes with wire-valid type',
      { event }
    );
    return {
      seq: args.base + index + 1,
      event,
      actor: args.actor,
      ts: args.ts,
    };
  });
}
