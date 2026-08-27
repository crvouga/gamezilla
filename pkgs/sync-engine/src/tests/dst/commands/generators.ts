import fc from 'fast-check';

import type { LibraryAction } from '../actions';
import type { WorldCmd } from './index-types';
import {
  AUTH_STATUSES,
  CLIENT_IDS,
  HOLD_TRAFFIC,
  HTTP_FAULTS,
  WORLD_PBT_CRASH_EVENTS,
} from '../model';

const trafficArb = fc.constantFrom(...HOLD_TRAFFIC);

type PickClient = fc.Arbitrary<string>;

export function connectivityCommandArbs(
  pickClient: PickClient,
  clientCmd: (
    kind: Extract<
      LibraryAction['kind'],
      | 'offline'
      | 'online'
      | 'disconnect'
      | 'connect'
      | 'background'
      | 'foreground'
    >,
    clientId: string
  ) => WorldCmd
): fc.Arbitrary<WorldCmd>[] {
  return [
    pickClient.map((c) => clientCmd('offline', c)),
    pickClient.map((c) => clientCmd('online', c)),
    pickClient.map((c) => clientCmd('disconnect', c)),
    pickClient.map((c) => clientCmd('connect', c)),
    pickClient.map((c) => clientCmd('background', c)),
    pickClient.map((c) => clientCmd('foreground', c)),
  ];
}

type NetCmd = (n: string, t: 'live' | 'sync' | 'all') => WorldCmd;

export function networkCommandArbs(args: {
  readonly pickClient: PickClient;
  readonly partitionCmd: NetCmd;
  readonly holdCmd: NetCmd;
  readonly releaseCmd: NetCmd;
  readonly healCmd: WorldCmd;
  readonly idleCmd: (ms: number) => WorldCmd;
}): fc.Arbitrary<WorldCmd>[] {
  return [
    fc
      .tuple(args.pickClient, trafficArb)
      .map(([c, t]) => args.partitionCmd(c, t)),
    fc.tuple(args.pickClient, trafficArb).map(([c, t]) => args.holdCmd(c, t)),
    fc
      .tuple(args.pickClient, trafficArb)
      .map(([c, t]) => args.releaseCmd(c, t)),
    fc.constant(args.healCmd),
    fc.integer({ min: 1, max: 40 }).map(args.idleCmd),
  ];
}

export function faultCommandArbs(args: {
  readonly pickClient: PickClient;
  readonly httpFaultCmd: (
    c: string,
    f: (typeof HTTP_FAULTS)[number]
  ) => WorldCmd;
  readonly crashAtCmd: (
    c: string,
    e: (typeof WORLD_PBT_CRASH_EVENTS)[number]
  ) => WorldCmd;
  readonly publishCmd: (count: number | 'next') => WorldCmd;
  readonly authCmd: (
    c: string,
    status: (typeof AUTH_STATUSES)[number]
  ) => WorldCmd;
}): fc.Arbitrary<WorldCmd>[] {
  return [
    fc
      .tuple(args.pickClient, fc.constantFrom(...HTTP_FAULTS))
      .map(([c, f]) => args.httpFaultCmd(c, f)),
    fc
      .tuple(args.pickClient, fc.constantFrom(...WORLD_PBT_CRASH_EVENTS))
      .map(([c, e]) => args.crashAtCmd(c, e)),
    fc.constantFrom(1, 2, 'next' as const).map(args.publishCmd),
    fc
      .tuple(args.pickClient, fc.constantFrom(...AUTH_STATUSES))
      .map(([c, status]) => args.authCmd(c, status)),
  ];
}

export function lifecycleCommandArbs(args: {
  readonly ids: readonly string[];
  readonly pickClient: PickClient;
  readonly crashCmd: (c: string) => WorldCmd;
  readonly restartCmd: (c: string) => WorldCmd;
  readonly clearCmd: (c: string) => WorldCmd;
  readonly subscribeCmd: (c: string) => WorldCmd;
  readonly skewCmd: (nodeId: string, ms: number) => WorldCmd;
}): fc.Arbitrary<WorldCmd>[] {
  return [
    args.pickClient.map(args.crashCmd),
    args.pickClient.map(args.restartCmd),
    args.pickClient.map(args.clearCmd),
    args.pickClient.map(args.subscribeCmd),
    fc
      .tuple(
        fc.constantFrom(...args.ids, 'server'),
        fc.constantFrom(-60_000, 0, 60_000)
      )
      .map(([nodeId, skewMs]) => args.skewCmd(nodeId, skewMs)),
  ];
}

export function defaultClientIds(
  clientIds: readonly string[]
): readonly string[] {
  return clientIds.length > 0 ? clientIds : [...CLIENT_IDS].slice(0, 2);
}
