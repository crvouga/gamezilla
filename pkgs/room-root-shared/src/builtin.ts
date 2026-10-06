import type { Message } from '@pkgs/message-shared/message';
import {
  createMessageNamespace,
  isMessageEnvelope,
  isPlainRecord,
} from '@pkgs/message-shared/message';

/** Identity used when the engine injects a scheduled command. */
export const ROOM_SCHEDULER_IDENTITY = 'room:scheduler';

/** Identity used when the engine injects a module's presence command. */
export const ROOM_PRESENCE_IDENTITY = 'room:presence';

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function isNonNegInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

function validateSchedulePayload(
  p: unknown
): p is { id: string; at: number; payload: Message } {
  if (!isPlainRecord(p)) return false;
  return (
    isNonEmptyString(p['id']) &&
    isNonNegInt(p['at']) &&
    isMessageEnvelope(p['payload'])
  );
}

function validateCancelPayload(p: unknown): p is { id: string } {
  return isPlainRecord(p) && isNonEmptyString(p['id']);
}

const effectNs = createMessageNamespace('room-effect');

/** Arm (or replace) a wake that injects `payload` as a command at epoch `at`. */
export const ScheduleEffect = effectNs('schedule', validateSchedulePayload);

/** Drop a pending schedule by id. */
export const CancelScheduleEffect = effectNs(
  'cancel-schedule',
  validateCancelPayload
);

export type ScheduleEffectPayload = {
  readonly id: string;
  readonly at: number;
  readonly payload: Message;
};
