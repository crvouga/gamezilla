import { describe, expect, test } from 'bun:test';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';
import type { ResolvedIdentity } from '@pkgs/observability-root-shared-ts/identity-resolver';
import type { LocalClock } from '@pkgs/observability-root-shared-ts/local-clock';
import { parseLocalClock } from '@pkgs/observability-root-shared-ts/local-clock';
import { NdjsonTraceStore } from '@pkgs/observability-root-shared-ts/ndjson';
import { normalizePersonName } from '@pkgs/observability-root-shared-ts/person-name';
import type { PersonDirectory } from '@pkgs/observability-root-shared-ts/person-trouble';
import { findPersonTrouble } from '@pkgs/observability-root-shared-ts/person-trouble';

const NOW_MS = Date.parse('2026-09-29T02:00:00.000Z');
const CHRIS = 'user-chris';
const OTHER = 'user-other';

function span(input: {
  readonly attributes: Readonly<Record<string, string>>;
  readonly name: string;
  readonly spanId: string;
  readonly status: 'error' | 'ok';
  readonly statusMessage?: string;
  readonly timestamp: string;
  readonly traceId: string;
}): string {
  return JSON.stringify({
    timestamp: input.timestamp,
    traceId: input.traceId,
    spanId: input.spanId,
    name: input.name,
    durationMs: 10,
    status: input.status,
    ...(input.statusMessage === undefined
      ? {}
      : { statusMessage: input.statusMessage }),
    attributes: input.attributes,
    events: [],
  });
}

const CRASH = span({
  timestamp: '2026-09-29T01:33:00.000Z',
  traceId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  spanId: 'bbbbbbbbbbbbbbbb',
  name: 'client.error',
  status: 'error',
  statusMessage: 'app crashed',
  attributes: {
    'user.id': CHRIS,
    'app.device.timezone': 'America/Phoenix',
  },
});

const CONNECTION = span({
  timestamp: '2026-09-29T01:33:05.000Z',
  traceId: 'cccccccccccccccccccccccccccccccc',
  spanId: 'dddddddddddddddd',
  name: 'http.server.request',
  status: 'ok',
  attributes: {
    'user.id': CHRIS,
    'app.client.city': 'Phoenix',
    'app.client.region': 'Arizona',
    'app.client.country': 'US',
  },
});

const VEGAS = span({
  timestamp: '2026-09-29T01:33:02.000Z',
  traceId: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  spanId: 'ffffffffffffffff',
  name: 'client.error',
  status: 'error',
  statusMessage: 'app crashed',
  attributes: {
    'user.id': OTHER,
    'app.device.timezone': 'America/Phoenix',
    'app.client.city': 'Las Vegas',
    'app.client.region': 'Nevada',
  },
});

function storeOf(lines: readonly string[]): NdjsonTraceStore {
  const text = lines.join('\n');
  const bytes = new TextEncoder().encode(text);
  const files: ObjectStore = {
    async get() {
      return {
        body: new Blob([bytes]).stream(),
        contentType: 'application/x-ndjson',
        size: bytes.byteLength,
      };
    },
    async put() {},
    async head() {
      return true;
    },
    async delete() {},
    async deleteMany() {},
    async getUri() {
      return null;
    },
    async listKeys() {
      return ['trace.ndjson'];
    },
    withPrefix() {
      return this;
    },
  };
  return new NdjsonTraceStore(files, 'fixture');
}

function directory(
  people: readonly ResolvedIdentity[]
): PersonDirectory & { readonly lookedUp: string[] } {
  const lookedUp: string[] = [];
  return {
    lookedUp,
    async resolvePeople(name) {
      lookedUp.push(name);
      const key = normalizePersonName(name);
      if (key !== 'chris vouga') return [];
      return people;
    },
  };
}

function clock(text: string): LocalClock {
  const parsed = parseLocalClock(text, NOW_MS);
  if (parsed === undefined) throw new Error(`unparsed clock ${text}`);
  return parsed;
}

describe('finding a person from a name, a place, and their own clock', () => {
  test('6:33pm MST is 01:33 UTC that evening in Arizona', () => {
    expect(clock('6:33pm MST').instantMs).toBe(
      Date.parse('2026-09-29T01:33:00.000Z')
    );
    expect(clock('6:33pm MST').timeZone).toBe('America/Phoenix');
    expect(clock('6:33 in the evening Mountain time').instantMs).toBe(
      clock('6:33pm MST').instantMs
    );
    expect(clock('9:00 in the morning Mountain time').instantMs).toBe(
      Date.parse('2026-09-28T16:00:00.000Z')
    );
    expect(parseLocalClock('6:33pm', NOW_MS)).toBeUndefined();
    expect(parseLocalClock('6:33pm America/Denver', NOW_MS)).toBeUndefined();
  });

  test('Gilbert, Arizona at 6:33pm MST finds the crash and the device clock', async () => {
    const people = directory([{ userId: CHRIS, matchedAs: 'name' }]);
    const report = await findPersonTrouble(
      storeOf([CRASH, CONNECTION]),
      people,
      {
        name: 'Chris Vouga',
        at: '6:33pm MST',
        place: 'Gilbert, Arizona',
        nowMs: NOW_MS,
      }
    );
    expect(report.code).toBe(0);
    expect(report.sawTrouble).toBe(true);
    expect(report.userIds).toEqual([CHRIS]);
    expect(report.text).toContain(`person: Chris Vouga -> user.id ${CHRIS}`);
    expect(report.text).toContain(
      '18:33 MST (UTC-07:00) = 2026-09-29T01:33:00.000Z'
    );
    expect(report.text).toContain('connection: Phoenix, Arizona, US');
    expect(report.text).toContain('device-clock: America/Phoenix');
    expect(report.text).toContain('place: matched Gilbert, Arizona');
    expect(report.text).toContain('app crashed');
    expect(report.text).toContain(
      'next: bun obs span aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa bbbbbbbbbbbbbbbb'
    );
    expect(report.text).not.toContain(OTHER);
  });

  test('a Las Vegas connection still returns the Arizona crash and says where it appeared', async () => {
    const report = await findPersonTrouble(
      storeOf([CRASH, CONNECTION]),
      directory([{ userId: CHRIS, matchedAs: 'name' }]),
      {
        name: 'Chris Vouga',
        at: '6:33pm MST',
        place: 'Las Vegas',
        nowMs: NOW_MS,
      }
    );
    expect(report.code).toBe(0);
    expect(report.sawTrouble).toBe(true);
    expect(report.text).toContain(
      'place: asked Las Vegas; connection appeared at Phoenix, Arizona, US'
    );
    expect(report.text).toContain('device-clock: America/Phoenix');
    expect(report.text).toContain('app crashed');
  });

  test('a morning lookup does not show the evening crash', async () => {
    const report = await findPersonTrouble(
      storeOf([CRASH, CONNECTION]),
      directory([{ userId: CHRIS, matchedAs: 'name' }]),
      {
        name: 'Chris Vouga',
        at: '9:00 in the morning Mountain time',
        place: 'Gilbert, Arizona',
        nowMs: NOW_MS,
      }
    );
    expect(report.code).toBe(1);
    expect(report.sawTrouble).toBe(false);
    expect(report.text).toContain(
      'Nothing happened for Chris Vouga at that time.'
    );
    expect(report.text).toContain(`person: Chris Vouga -> user.id ${CHRIS}`);
  });

  test('an unknown name is not sent to the trace store', async () => {
    const store = storeOf([CRASH, CONNECTION]);
    store.findByUser = () => {
      throw new Error('raw name reached telemetry');
    };
    const report = await findPersonTrouble(
      store,
      directory([{ userId: CHRIS, matchedAs: 'name' }]),
      { name: 'Nobody Home', at: '6:33pm MST', nowMs: NOW_MS }
    );
    expect(report.code).toBe(1);
    expect(report.data?.status).toBe('account-not-found');
    expect(report.text).toContain('No account is named "Nobody Home"');
    expect(report.text).not.toContain('Nothing happened');
    expect(report.text).toContain(
      'next: bun obs person --name "<username or email>" --at "6:33pm MST" --window 30m'
    );
    expect(report.userIds).toEqual([]);
  });

  test('the same name in two places keeps the city that was asked', async () => {
    const report = await findPersonTrouble(
      storeOf([CRASH, CONNECTION, VEGAS]),
      directory([
        { userId: CHRIS, matchedAs: 'name' },
        { userId: OTHER, matchedAs: 'name' },
      ]),
      {
        name: 'Chris   Vouga',
        at: '18:33 MST',
        place: 'Las Vegas',
        nowMs: NOW_MS,
      }
    );
    expect(report.userIds).toEqual([OTHER]);
    expect(report.text).toContain(
      'people: 2 share this name; 1 match this place and time'
    );
    expect(report.text).toContain(`person: Chris   Vouga -> user.id ${OTHER}`);
    expect(report.text).not.toContain(
      `person: Chris   Vouga -> user.id ${CHRIS}`
    );
    expect(report.text).toContain(
      `user.id ${CHRIS}: left out; connection appeared at Phoenix, Arizona, US, not Las Vegas`
    );
    expect(report.text).toContain(
      `user.id ${OTHER}: shown; connection city matched Las Vegas`
    );
    expect(report.text).toContain('place: matched Las Vegas');
    expect(report.text).toContain('connection: Las Vegas, Nevada');
  });

  test('a clock with no zone is usage, and a missing directory is unavailable', async () => {
    const store = storeOf([CRASH]);
    const unzoned = await findPersonTrouble(
      store,
      directory([{ userId: CHRIS, matchedAs: 'name' }]),
      { name: 'Chris Vouga', at: '6:33pm', nowMs: NOW_MS }
    );
    expect(unzoned.code).toBe(2);
    expect(unzoned.text).toContain('6:33pm MST');
    const missing = await findPersonTrouble(store, undefined, {
      name: 'Chris Vouga',
      at: '6:33pm MST',
      nowMs: NOW_MS,
    });
    expect(missing.code).toBe(2);
    expect(missing.unavailable).toBe(true);
  });
});
