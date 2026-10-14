import { createAttrNamespace } from '@pkgs/attribute-shared/attribute';
import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared/message';
import { createMessageRouter } from '@pkgs/message-shared/router';
import type {
  HandleResult,
  RoomActor,
  RoomState,
} from '@pkgs/room-root-shared/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared/types';
import type { GameCommandContext } from './game';
import { isViewingSpaceClient } from './space-presence-client-id';

/** Quiet this long, on every connected device that is in the space, is idle. */
export const IDLE_AFTER_MS = 120_000;

export type ActivityMap = Readonly<Record<string, number>>;

function isClientId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function parseActivity(value: unknown): ActivityMap {
  if (!isPlainRecord(value)) return {};
  const out: Record<string, number> = {};
  for (const [clientId, at] of Object.entries(value)) {
    if (!isClientId(clientId)) continue;
    if (typeof at !== 'number' || !Number.isInteger(at) || at < 0) continue;
    out[clientId] = at;
  }
  return out;
}

const activityNs = createAttrNamespace('space', 'activity');

/** Last time each device did something in the space, in room time. */
export const SpaceActivityAttr = {
  activity: activityNs.json('last', parseActivity),
} as const;

export const spaceActivityCmdNs = createMessageNamespace('space-activity-cmd');

/** This device did something in the space at the supplied device time. */
export const NoteActivity = spaceActivityCmdNs(
  'note-activity',
  (value): value is { readonly clientId: string; readonly at: number } =>
    isPlainRecord(value) &&
    isClientId(value['clientId']) &&
    typeof value['at'] === 'number' &&
    Number.isInteger(value['at']) &&
    value['at'] >= 0
);

export const spaceActivityEvtNs = createMessageNamespace('space-activity-evt');

export const ActivityNoted = spaceActivityEvtNs(
  'activity-noted',
  (value): value is { readonly clientId: string; readonly at: number } =>
    isPlainRecord(value) &&
    isClientId(value['clientId']) &&
    typeof value['at'] === 'number' &&
    Number.isInteger(value['at']) &&
    value['at'] >= 0
);

export const spaceActivityCommandRouter = createMessageRouter<
  RoomState,
  GameCommandContext,
  HandleResult
>(spaceActivityCmdNs).on(NoteActivity, (state, ctx, command) => {
  const clientId = command.payload.clientId;
  const current = SpaceActivityAttr.activity.from(state)[clientId];
  const at = Math.min(command.payload.at, ctx.ts);
  if (current !== undefined && current >= at) {
    return {
      ok: false,
      error: { type: ROOM_ERROR_TYPE.conflict, reason: 'activity unchanged' },
    };
  }
  return { ok: true, events: [ActivityNoted({ clientId, at })] };
});

export const spaceActivityEventReducer = createMessageRouter<
  RoomState,
  void,
  RoomState
>(spaceActivityEvtNs).on(ActivityNoted, (state, _ctx, evt) => ({
  ...state,
  ...SpaceActivityAttr.activity({
    ...SpaceActivityAttr.activity.from(state),
    [evt.payload.clientId]: evt.payload.at,
  }),
}));

function viewingByPerson(
  roster: readonly RoomActor[]
): ReadonlyMap<string, readonly string[]> {
  const grouped = new Map<string, string[]>();
  for (const actor of roster) {
    if (!isViewingSpaceClient(actor.clientId)) continue;
    const clients = grouped.get(actor.id);
    if (clients === undefined) grouped.set(actor.id, [actor.clientId]);
    else clients.push(actor.clientId);
  }
  return grouped;
}

function clientQuiet(
  activity: ActivityMap,
  clientId: string,
  nowMs: number
): boolean {
  const at = activity[clientId];
  if (at === undefined) return false;
  return nowMs - at >= IDLE_AFTER_MS;
}

/** A person is idle only when every device of theirs in the space is quiet. */
export function idleMemberIds(input: {
  readonly roster: readonly RoomActor[];
  readonly activity: ActivityMap;
  readonly connected: boolean;
  readonly nowMs: number;
}): ReadonlySet<string> {
  if (!input.connected) return new Set();
  const idle = new Set<string>();
  for (const [memberId, clients] of viewingByPerson(input.roster)) {
    if (clients.length === 0) continue;
    const quiet = clients.every((clientId) =>
      clientQuiet(input.activity, clientId, input.nowMs)
    );
    if (quiet) idle.add(memberId);
  }
  return idle;
}

/** When the next person would become idle if nobody does anything. */
export function nextIdleChangeAt(input: {
  readonly roster: readonly RoomActor[];
  readonly activity: ActivityMap;
  readonly connected: boolean;
  readonly nowMs: number;
}): number | null {
  if (!input.connected) return null;
  let earliest: number | null = null;
  for (const clients of viewingByPerson(input.roster).values()) {
    const deadline = personIdleAt(clients, input.activity);
    if (deadline === null || deadline <= input.nowMs) continue;
    if (earliest === null || deadline < earliest) earliest = deadline;
  }
  return earliest;
}

function personIdleAt(
  clients: readonly string[],
  activity: ActivityMap
): number | null {
  let latest = 0;
  for (const clientId of clients) {
    const at = activity[clientId];
    if (at === undefined) return null;
    if (at > latest) latest = at;
  }
  return latest + IDLE_AFTER_MS;
}
