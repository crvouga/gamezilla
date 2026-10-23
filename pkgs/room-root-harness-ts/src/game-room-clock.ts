import { createAttrNamespace } from '@pkgs/attribute-shared-ts/attribute';
import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared-ts/message';
import type { RoomState } from '@pkgs/room-root-shared-ts/types';

export function isNonNegInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

const ns = createAttrNamespace('game-room');
export const whiteMsAttr = ns.integer('white-ms', (value) =>
  isNonNegInt(value) ? value : 0
);
export const blackMsAttr = ns.integer('black-ms', (value) =>
  isNonNegInt(value) ? value : 0
);
export const turnStartedAtAttr = ns.integer('turn-started-at', (value) =>
  isNonNegInt(value) ? value : 0
);
export const clocksPausedAttr = ns.integer('clocks-paused', (value) =>
  value === 1 ? 1 : 0
);
const events = createMessageNamespace('game-room-evt');
export const ClockAvailabilityChanged = events(
  'clock-availability-changed',
  (
    value
  ): value is {
    paused: boolean;
    whiteMs: number;
    blackMs: number;
    turnStartedAt: number;
  } =>
    isPlainRecord(value) &&
    typeof value['paused'] === 'boolean' &&
    isNonNegInt(value['whiteMs']) &&
    isNonNegInt(value['blackMs']) &&
    isNonNegInt(value['turnStartedAt'])
);

export function clockAvailability(
  state: RoomState,
  available: boolean,
  now: number,
  toMove: 'white' | 'black'
) {
  const paused = clocksPausedAttr.from(state) === 1;
  if (paused === !available) return null;
  const elapsed = paused ? 0 : Math.max(0, now - turnStartedAtAttr.from(state));
  const whiteMs = whiteMsAttr.from(state);
  const blackMs = blackMsAttr.from(state);
  return ClockAvailabilityChanged({
    paused: !available,
    whiteMs: toMove === 'white' ? Math.max(0, whiteMs - elapsed) : whiteMs,
    blackMs: toMove === 'black' ? Math.max(0, blackMs - elapsed) : blackMs,
    turnStartedAt: now,
  });
}

export function reduceClockAvailability(
  state: RoomState,
  event: ReturnType<typeof ClockAvailabilityChanged>
): RoomState {
  return {
    ...state,
    ...clocksPausedAttr(event.payload.paused ? 1 : 0),
    ...whiteMsAttr(event.payload.whiteMs),
    ...blackMsAttr(event.payload.blackMs),
    ...turnStartedAtAttr(event.payload.turnStartedAt),
  };
}
