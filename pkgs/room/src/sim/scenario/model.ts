import type { AsyncCommand } from 'fast-check';

import { ROOM_WIRE_KIND, WIRE_VERSION } from '../../protocol/wire';
import { ROOM_ERROR_TYPE } from '../../types';
import { SIM_PBT_CRASH_EVENTS } from '../boundary-faults';
import type { RoomFaultProfile } from '../network';
import type { RoomSystemAction } from './actions';

export { CLIENT_IDS } from './client-ids';

export { SIM_PBT_CRASH_EVENTS };

/** Mild net profiles for catalog PBTs (includes reorder/dup). */
export const NET_FAULT_PROFILES: readonly RoomFaultProfile[] = [
  {
    latencyMeanMs: 5,
    latencyJitterMs: 5,
    dropProbability: 0.05,
  },
  {
    latencyMeanMs: 2,
    latencyJitterMs: 8,
    dropProbability: 0.1,
    reorderProbability: 0.15,
  },
  {
    latencyMeanMs: 0,
    latencyJitterMs: 0,
    dropProbability: 0.08,
    duplicateProbability: 0.1,
  },
  {
    latencyMeanMs: 10,
    latencyJitterMs: 10,
    dropProbability: 0.05,
    reorderProbability: 0.1,
    duplicateProbability: 0.05,
  },
] as const;

export type ByzantineInjectKind =
  | 'malformed'
  | 'unknownKind'
  | 'staleSync'
  | 'ping'
  | 'forgedCommitted'
  | 'staleWelcome'
  | 'forgedRejected'
  | 'forgedRoster'
  | 'garbagePong';

export const BYZANTINE_INJECT_KINDS: readonly ByzantineInjectKind[] = [
  'malformed',
  'unknownKind',
  'staleSync',
  'ping',
  'forgedCommitted',
  'staleWelcome',
  'forgedRejected',
  'forgedRoster',
  'garbagePong',
] as const;

export function buildByzantineRaw(
  kind: ByzantineInjectKind,
  now: number
): { readonly direction: 'toServer' | 'toClient'; readonly raw: unknown } {
  switch (kind) {
    case 'malformed':
      return { direction: 'toServer', raw: 'not-json-object' };
    case 'unknownKind':
      return {
        direction: 'toServer',
        raw: { v: WIRE_VERSION, kind: 'nope' },
      };
    case 'staleSync':
      return {
        direction: 'toServer',
        raw: { v: WIRE_VERSION, kind: ROOM_WIRE_KIND.sync, fromSeq: 999 },
      };
    case 'ping':
      return {
        direction: 'toServer',
        raw: { v: WIRE_VERSION, kind: ROOM_WIRE_KIND.ping },
      };
    case 'forgedCommitted':
      return {
        direction: 'toClient',
        raw: {
          v: WIRE_VERSION,
          kind: ROOM_WIRE_KIND.committed,
          commandId: 'forged',
          entries: [
            {
              seq: 99,
              event: {
                type: 'space-counter-evt/counter-incremented',
                payload: {},
              },
              actor: { id: 'eve', clientId: 'eve' },
              ts: now,
            },
          ],
        },
      };
    case 'staleWelcome':
      return {
        direction: 'toClient',
        raw: {
          v: WIRE_VERSION,
          kind: ROOM_WIRE_KIND.welcome,
          fromSeq: 0,
          lastSeq: 0,
          entries: [],
        },
      };
    case 'forgedRejected':
      return {
        direction: 'toClient',
        raw: {
          v: WIRE_VERSION,
          kind: ROOM_WIRE_KIND.rejected,
          commandId: 'ghost',
          error: {
            type: ROOM_ERROR_TYPE.invalidCommand,
            reason: 'forged',
          },
        },
      };
    case 'forgedRoster':
      return {
        direction: 'toClient',
        raw: {
          v: WIRE_VERSION,
          kind: ROOM_WIRE_KIND.roster,
          clients: [{ id: 'ghost', clientId: 'ghost' }],
        },
      };
    case 'garbagePong':
      return {
        direction: 'toClient',
        raw: { v: WIRE_VERSION, kind: ROOM_WIRE_KIND.pong },
      };
  }
}

export type RoomReal = {
  readonly clientIds: readonly string[];
  readonly actions: RoomSystemAction[];
};

export type RoomCmd = AsyncCommand<
  import('./action-shadow').ActionShadow,
  RoomReal
>;

export {
  type ActionShadow as RoomModel,
  applyActionToShadow as applyActionToModel,
  clientLive,
  createActionShadow as initialRoomModel,
  domainOp,
  shadowAllowsAction as modelAllowsAction,
} from './action-shadow';
