import type { ResolvedIdentity } from '@pkgs/observability-root-shared/identity-resolver';
import { normalizePersonName } from '@pkgs/observability-root-shared/person-name';
import type { PersonDirectory } from '@pkgs/observability-root-shared/person-trouble';
import type { FixtureSpan } from './trace-fixtures';

/** 7pm MST on 20 October: 02:00 UTC on the 21st. */
export const NOW_MS = Date.parse('2026-10-21T03:00:00.000Z');
export const ASKED_MS = Date.parse('2026-10-21T02:00:00.000Z');
export const ADA = 'user-ada';
export const BOB = 'user-bob';
export const MINUTE = 60_000;

export const ADA_ID: ResolvedIdentity = { userId: ADA, matchedAs: 'name' };

export function directoryOf(
  name: string,
  people: readonly ResolvedIdentity[]
): PersonDirectory {
  const wanted = normalizePersonName(name);
  return {
    async resolvePeople(asked) {
      return normalizePersonName(asked) === wanted ? people : [];
    },
  };
}

/** Ada's evening: a crash before sign-in, then use, a 500 and a rejection. */
export function adaEvening(): FixtureSpan[] {
  const ada = {
    'user.id': ADA,
    'session.id': 'session-1',
    'app.device.id': 'device-1',
    'app.build.sha': 'abc1234',
  };
  return [
    {
      trace: 1,
      atMs: ASKED_MS - 10 * MINUTE,
      name: 'client.error',
      status: 'error',
      statusMessage: 'Network request failed',
      attributes: { 'session.id': 'session-1', 'app.device.id': 'device-1' },
    },
    {
      trace: 2,
      atMs: ASKED_MS - 8 * MINUTE,
      name: 'route.change',
      attributes: { ...ada, 'app.interaction.target': 'window:history' },
    },
    {
      trace: 2,
      atMs: ASKED_MS - 7 * MINUTE,
      name: 'interaction.click',
      attributes: {
        ...ada,
        'app.interaction.type': 'click',
        'app.interaction.target': 'SignInButton',
        'app.interaction.outcome': 'request',
      },
    },
    {
      trace: 3,
      atMs: ASKED_MS - 5 * MINUTE,
      name: 'http.server.request',
      spanId: 'aaaaaaaaaaaaaaaa',
      durationMs: 120,
      attributes: {
        ...ada,
        'http.request.method': 'GET',
        'http.route': '/api/profile',
        'http.response.status_code': 200,
        'app.client.city': 'Gilbert',
        'app.client.region': 'Arizona',
        'app.client.country': 'US',
        'app.device.timezone': 'America/Phoenix',
      },
    },
    ...[0, 1].map((index) => ({
      trace: 3,
      atMs: ASKED_MS - 5 * MINUTE + 10 + index,
      name: 'db.query',
      parent: 'aaaaaaaaaaaaaaaa',
      durationMs: 30,
      attributes: { ...ada, 'db.system.name': 'postgresql' },
    })),
    {
      trace: 4,
      atMs: ASKED_MS - MINUTE,
      name: 'mutation.replay',
      attributes: {
        ...ada,
        'app.mutation.id': 'mut-1',
        'app.mutation.name': 'profile.rename',
      },
    },
    {
      trace: 5,
      atMs: ASKED_MS,
      name: 'mutation.replay',
      status: 'error',
      statusMessage: 'NOT_FOUND',
      attributes: { ...ada, 'app.mutation.id': 'mut-2' },
      events: [
        {
          name: 'app.mutation.rejected',
          attributes: { 'app.mutation.id': 'mut-2' },
        },
      ],
    },
    {
      trace: 6,
      atMs: ASKED_MS + 2 * MINUTE,
      name: 'http.server.request',
      status: 'error',
      statusMessage: 'boom',
      attributes: {
        ...ada,
        'http.request.method': 'POST',
        'http.route': '/api/mutations',
        'http.response.status_code': 500,
      },
    },
    {
      trace: 7,
      atMs: ASKED_MS + 3 * MINUTE,
      name: 'room.websocket.message',
      attributes: {
        ...ada,
        'app.room.topic': 'chess:abc',
        'app.room.outcome': 'accepted',
        'app.room.message_bytes': 120,
      },
    },
    {
      trace: 8,
      atMs: ASKED_MS + 4 * MINUTE,
      name: 'outbox.drain',
      durationMs: 2_500,
      attributes: ada,
    },
  ];
}

/** Someone else on the same device after Ada: not Ada's activity. */
export function bobOnAdasDevice(): FixtureSpan[] {
  return [
    {
      trace: 20,
      atMs: ASKED_MS + MINUTE,
      name: 'client.error',
      status: 'error',
      statusMessage: 'bob only',
      attributes: { 'user.id': BOB, 'app.device.id': 'device-1' },
    },
  ];
}
