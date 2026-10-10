import type { Timers } from '@pkgs/clock-shared/types';
import type { ClientTransport } from '@pkgs/room-root-shared/transport';
import {
  parseServerToClientWire,
  ROOM_WIRE_KIND,
  WIRE_VERSION,
} from '@pkgs/room-root-shared/wire';

/** Ask the real room boundary for its history, ignoring availability frames. */
export async function roomHistoryDisclosed(
  transport: ClientTransport,
  timers: Timers
): Promise<boolean> {
  let finish: (value: boolean) => void = () => {};
  let refuse: (cause: Error) => void = () => {};
  const answer = new Promise<boolean>((resolve, reject) => {
    finish = resolve;
    refuse = reject;
  });
  const deadline = timers.setTimeout(
    () => refuse(new Error('room history did not answer')),
    5_000
  );
  const unsubscribe = transport.subscribe((raw) => {
    const frame = parseServerToClientWire(raw);
    if (frame?.kind !== ROOM_WIRE_KIND.welcome) return;
    finish(frame.entries.length > 0);
  });
  try {
    await transport.connect();
    transport.sendJson({
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.sync,
      fromSeq: 0,
    });
    return await answer;
  } finally {
    timers.clearTimeout(deadline);
    unsubscribe();
  }
}
