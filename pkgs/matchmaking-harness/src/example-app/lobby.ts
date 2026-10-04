/**
 * The example app's lobby: named people wait for a rated match through the
 * matchmaking port. Each person has at most one wait at a time — asking
 * again while waiting is refused — and stops or changes only their own
 * wait. The person's current wait is the harness alias (`refs`) of their
 * name, so the port reads (`statusOf`) see the same wait.
 */

import { defineAction, type JsonValue } from '@pkgs/harness';
import type { MatchmakingHarness } from '../scenario/facade';
import { NameAttr, RatingAttr, RegionAttr, ratingWithin } from './attrs';
import { deviceAt, type PersonDevice, refreshDevices } from './devices';

export type WaitForMatchSpec = PersonDevice & {
  readonly rating: number;
  readonly range: number;
  readonly requestId?: string;
  readonly groupSize?: number;
  readonly pool?: string;
};

async function begin(s: MatchmakingHarness, spec: WaitForMatchSpec) {
  const input = {
    ownerId: spec.person,
    requestId: spec.requestId ?? s.session.ports.createId(),
    data: {
      ...RatingAttr(spec.rating),
      ...NameAttr(spec.person),
      ...(spec.pool === undefined ? {} : RegionAttr(spec.pool)),
    },
    formulas: [
      {
        ...ratingWithin(spec.range),
        ...(spec.pool === undefined
          ? {}
          : { partition: [{ tag: RegionAttr }] }),
      },
    ],
    ...(spec.groupSize === undefined ? {} : { groupSize: spec.groupSize }),
  };
  const client = deviceAt(s, spec);
  const result = await client.begin(input);
  s.last.offline = result === null;
  s.last.begin = result;
  if (result === null) return;
  const records = s.begins.get(spec.person) ?? [];
  if (!records.some((r) => r.requestId === input.requestId))
    records.push(input);
  s.begins.set(spec.person, records);
  if (result.participantId !== null) {
    s.refs.set(spec.person, result.participantId);
    s.owners.set(result.participantId, spec.person);
  }
  s.last.wait =
    result.outcome === 'already_waiting'
      ? 'alreadyWaiting'
      : result.outcome === 'started'
        ? 'waiting'
        : 'unavailable';
  await refreshDevices(s);
}

export const waitForMatch = defineAction({
  name: 'waitForMatch',
  pool: false,
  act: (s: MatchmakingHarness, spec: WaitForMatchSpec) => begin(s, spec),
});

export const stopWaiting = defineAction({
  name: 'stopWaiting',
  pool: false,
  act: async (
    s: MatchmakingHarness,
    spec: PersonDevice & {
      readonly participantId?: string;
      readonly requestId?: string;
    }
  ) => {
    const client = deviceAt(s, spec);
    await client.refresh();
    s.last.leave = await client.stop({
      participantId:
        spec.participantId ?? client.view()?.participantId ?? 'unknown-wait',
      requestId: spec.requestId ?? s.session.ports.createId(),
    });
    s.last.offline = s.last.leave === null;
    await refreshDevices(s);
  },
});

export const changeRange = defineAction({
  name: 'changeRange',
  pool: false,
  act: async (
    s: MatchmakingHarness,
    spec: PersonDevice & {
      readonly range: number;
      readonly participantId?: string;
      readonly requestId?: string;
    }
  ) => {
    const client = deviceAt(s, spec);
    await client.refresh();
    const request = {
      ownerId: spec.person,
      participantId:
        spec.participantId ?? client.view()?.participantId ?? 'unknown-wait',
      requestId: spec.requestId ?? s.session.ports.createId(),
    };
    const partition = client.view()?.formulas[0]?.partition;
    const formulas = [
      {
        ...ratingWithin(spec.range),
        ...(partition?.some((term) => term.path === RegionAttr.key)
          ? { partition: [{ tag: RegionAttr }] }
          : {}),
      },
    ];
    s.last.update = await client.change(request, formulas);
    s.last.offline = s.last.update === null;
    if (s.last.update?.updated) {
      const records = s.changes.get(request.participantId) ?? [];
      if (!records.some((r) => r.request.requestId === request.requestId))
        records.push({ request, formulas });
      s.changes.set(request.participantId, records);
    }
    await refreshDevices(s);
  },
});

export const connectDevice = defineAction({
  name: 'connectDevice',
  pool: false,
  act: async (
    s: MatchmakingHarness,
    spec: PersonDevice & { readonly connected: boolean }
  ) => {
    await deviceAt(s, spec).setConnected(spec.connected);
  },
});

export const availability = defineAction({
  name: 'availability',
  pool: false,
  act: async (
    s: MatchmakingHarness,
    spec: { readonly person: string; readonly available: boolean }
  ) => {
    await s.mm.setAvailable(spec.person, spec.available);
    await refreshDevices(s);
  },
});

export const restriction = defineAction({
  name: 'restriction',
  pool: false,
  act: async (
    s: MatchmakingHarness,
    spec: {
      readonly person: string;
      readonly other: string;
      readonly restricted: boolean;
    }
  ) => {
    await s.mm.setRestriction(spec.person, spec.other, spec.restricted);
    await refreshDevices(s);
  },
});

export const timePasses = defineAction({
  name: 'timePasses',
  pool: false,
  act: async (s: MatchmakingHarness, seconds: number) => {
    await s.session.advanceTime(seconds * 1000);
    await refreshDevices(s);
  },
});

export const repeatBegin = defineAction({
  name: 'repeatBegin',
  pool: false,
  act: async (
    s: MatchmakingHarness,
    spec: PersonDevice & { readonly number?: number }
  ) => {
    const input = s.begins.get(spec.person)?.[(spec.number ?? 1) - 1];
    if (input === undefined) throw new Error('no earlier begin request');
    s.last.begin = await deviceAt(s, spec).begin(input);
    s.last.offline = s.last.begin === null;
    await refreshDevices(s);
  },
});

export const repeatChange = defineAction({
  name: 'repeatChange',
  pool: false,
  act: async (
    s: MatchmakingHarness,
    spec: PersonDevice & {
      readonly participantId?: string;
      readonly number?: number;
    }
  ) => {
    const participantId =
      spec.participantId ?? s.refs.get(spec.person) ?? 'unknown-wait';
    const record = s.changes.get(participantId)?.[(spec.number ?? 1) - 1];
    if (record === undefined) throw new Error('no earlier change request');
    s.last.update = await deviceAt(s, spec).change(
      record.request,
      record.formulas
    );
    s.last.offline = s.last.update === null;
    await refreshDevices(s);
  },
});

export function lastWait(s: MatchmakingHarness): JsonValue {
  return s.last.wait;
}
export function lastBegin(s: MatchmakingHarness) {
  return s.last.begin;
}
export function lastOffline(s: MatchmakingHarness): boolean {
  return s.last.offline;
}

export const LOBBY_ACTIONS = [
  waitForMatch,
  stopWaiting,
  changeRange,
  connectDevice,
  availability,
  restriction,
  timePasses,
  repeatBegin,
  repeatChange,
] as const;
