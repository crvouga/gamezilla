import type { SyntheticPopulationConfig } from '@libs/synthetic-population-shared-ts/config';
import type { Inspection } from '@libs/synthetic-population-shared-ts/inspection';
import type { Persona } from '@libs/synthetic-population-shared-ts/persona';
import type { JSX } from 'solid-js';
import { fn } from 'storybook/test';
import { OnlineNowView, type OnlineNowViewProps } from './online-now-view';
import type {
  OnlineNowEntryView,
  SyntheticPopulationDirectoryPage,
  SyntheticPopulationEventView,
  SyntheticPopulationOverview,
  SyntheticUserDetail,
  SyntheticUserReplayResult,
} from './synthetic-population-api';
import {
  SyntheticPopulationUsersView,
  type SyntheticPopulationUsersViewProps,
} from './synthetic-population-users-view';
import { SyntheticUserReplayView } from './synthetic-user-replay-view';

/** Story-only Bot Observatory fixtures: fixed ids and instants, no I/O. */

export const OBSERVED_AT = '2026-03-14T12:00:00.000Z';
const OBSERVED_AT_MS = Date.parse(OBSERVED_AT);

export const CONFIG: SyntheticPopulationConfig = {
  desired: 24,
  capacityPerWorker: 8,
  leaseMs: 60_000,
  actionIntervalMs: 3_000,
  sessionMs: 1_800_000,
  preferredVersion: '2026.03.14-1',
  revision: 7,
};

type UserRow = SyntheticPopulationDirectoryPage['users'][number];

function checkpoint(
  activity: NonNullable<UserRow['checkpoint']>['activity'],
  route: string
): NonNullable<UserRow['checkpoint']> {
  return {
    schemaVersion: 1,
    activity,
    route,
    spaceId: '5b0e7c2a-0000-4000-8000-0000000000a1',
    matchId:
      activity === 'playing' ? '5b0e7c2a-0000-4000-8000-0000000000b1' : null,
    pendingOperationId: null,
    policySeed: 'seed-0001',
    decisions: 42,
    startedAtMs: Date.parse('2026-03-14T11:30:00.000Z'),
  };
}

/** A complete persona, as provisioning records it. */
export const PERSONA: Persona = {
  schemaVersion: 2,
  username: 'maplewood_fox',
  avatar: '{"style":"lorelei","seed":"maplewood_fox"}',
  homeRegion: 'Lisbon, PT',
  skillLevel: 'intermediate',
  favoriteGames: ['backgammon', 'go'],
  dailySchedule: { timeZone: 'Europe/Lisbon', startHour: 18, endHour: 23 },
  thinkingTime: { minMs: 3_000, maxMs: 14_000 },
  rematchWeight: 0.4,
  hostingWeight: 0.3,
};

/** One Synthetic User row; `overrides` shapes a particular state. */
export function userRow(
  index: number,
  username: string,
  overrides: Partial<UserRow> = {}
): UserRow {
  return {
    id: `7d3f0a10-0000-4000-8000-00000000000${index}`,
    account_id: `acct-${username}`,
    username,
    region: 'eu-west',
    paused: false,
    worker_id: 'worker-eu-1',
    generation: 3,
    lease_until: '2026-03-14T12:01:00.000Z',
    activity: 'playing',
    checkpoint: checkpoint('playing', '/games/chess/play'),
    application_version: '2026.03.14-1',
    last_action: 'tap chess-board e2-e4',
    last_error: null,
    inspection_requested_at: null,
    persona: PERSONA,
    created_at: '2026-03-01T09:00:00.000Z',
    updated_at: '2026-03-14T11:59:30.000Z',
    ...overrides,
  };
}

export const USERS: readonly UserRow[] = [
  userRow(1, 'bot_ada'),
  userRow(2, 'bot_bea', {
    activity: 'matchmaking',
    checkpoint: checkpoint('matchmaking', '/games/chess'),
  }),
  userRow(3, 'bot_cyrus', {
    paused: true,
    activity: 'browsing',
    checkpoint: checkpoint('browsing', '/'),
  }),
  userRow(4, 'bot_dee', {
    activity: 'recovering',
    region: 'us-east',
    worker_id: 'worker-us-1',
    last_error: 'Socket closed during move',
    // Recorded before personas: the directory falls back to its id.
    persona: null,
  }),
];

function event(
  index: number,
  name: string,
  context: SyntheticPopulationEventView['context']
): SyntheticPopulationEventView {
  return {
    id: `e1a2b3c4-0000-4000-8000-00000000000${index}`,
    user_id: USERS[0]?.id ?? null,
    worker_id: 'worker-eu-1',
    generation: 3,
    application_version: '2026.03.14-1',
    correlation_id: `corr-000${index}`,
    event: name,
    context,
    created_at: `2026-03-14T11:5${index}:00.000Z`,
  };
}

export const EVENTS: readonly SyntheticPopulationEventView[] = [
  event(1, 'SyntheticUserStarted', { route: '/' }),
  event(2, 'UiDriverAction', { action: 'tap' }),
  event(3, 'DecisionMade', { activity: 'playing', decisions: 42 }),
  event(4, 'WorkerLeaseRenewed', { leaseUntil: '2026-03-14T12:01:00.000Z' }),
];

type Worker = SyntheticPopulationOverview['workers'][number];

/** One worker heartbeat row; `overrides` shapes its health. */
export function worker(id: string, overrides: Partial<Worker> = {}): Worker {
  return {
    id,
    application_version: '2026.03.14-1',
    capacity: 8,
    draining: false,
    heartbeat_at: '2026-03-14T11:59:40.000Z',
    memory_bytes: 536_870_912,
    cpu_milliseconds: 84_215.4,
    lease_failures: 0,
    ...overrides,
  };
}

/** A running population: three workers (ready, draining, unreachable). */
export const OVERVIEW: SyntheticPopulationOverview = {
  config: CONFIG,
  online: 12,
  playing: 6,
  matchmaking: 3,
  recovering: 1,
  groups: [
    { activity: 'playing', region: 'eu-west', count: 4 },
    { activity: 'playing', region: 'us-east', count: 2 },
    { activity: 'matchmaking', region: 'eu-west', count: 3 },
  ],
  users: [...USERS],
  workers: [
    worker('worker-eu-1', {}),
    worker('worker-us-1', {
      draining: true,
      application_version: '2026.03.13-4',
    }),
    worker('worker-ap-1', {
      heartbeat_at: '2026-03-14T11:50:00.000Z',
      memory_bytes: null,
      cpu_milliseconds: null,
      lease_failures: 3,
    }),
  ],
  workerAssignments: [
    { worker_id: 'worker-eu-1', count: 6 },
    { worker_id: 'worker-us-1', count: 2 },
  ],
  events: [...EVENTS],
  observedAtMs: OBSERVED_AT_MS,
};

/** Nothing running yet: no users, workers or events. */
export const EMPTY_OVERVIEW: SyntheticPopulationOverview = {
  ...OVERVIEW,
  config: { ...CONFIG, desired: 0 },
  online: 0,
  playing: 0,
  matchmaking: 0,
  recovering: 0,
  groups: [],
  users: [],
  workers: [],
  workerAssignments: [],
  events: [],
};

export const PAGE: SyntheticPopulationDirectoryPage = {
  users: [...USERS],
  nextCursor: null,
};

const DIRECTORY: SyntheticPopulationUsersViewProps = {
  filter: '',
  page: PAGE,
  loading: false,
  failed: false,
  paged: false,
  canInspect: true,
  onFilterChange: fn().mockName('directory.onFilterChange'),
  onFirstPage: fn().mockName('directory.onFirstPage'),
  onNextPage: fn().mockName('directory.onNextPage'),
  onInspect: fn().mockName('directory.onInspect'),
  onRetry: fn().mockName('directory.onRetry'),
};

/** The directory slot in a given state, as the container would fill it. */
export function directory(
  overrides: Partial<SyntheticPopulationUsersViewProps> = {}
): () => JSX.Element {
  return () => <SyntheticPopulationUsersView {...DIRECTORY} {...overrides} />;
}

/** Live DOM capture for generation 3, mid-move in a chess game. */
export const SNAPSHOT: Inspection = {
  capturedAtMs: Date.parse('2026-03-14T11:59:50.000Z'),
  generation: 3,
  route: '/games/chess/play',
  html: '<main data-screen="chess-game">\n  <section data-testid="chess-board" role="grid" aria-label="Chess board"></section>\n  <button data-testid="chess-resign">Resign</button>\n</main>',
  state: '{"playing":"choosing"}',
  transitions: ['MOVE', 'COMPLETE', 'FAIL', 'RECOVER', 'STOP'],
  controls: [
    { testId: 'chess-board', role: 'grid', name: 'Chess board' },
    { testId: 'chess-resign', role: 'button', name: '' },
  ],
  actions: [
    {
      atMs: Date.parse('2026-03-14T11:59:41.000Z'),
      action: 'tap chess-board e2-e4',
      outcome: 'completed',
    },
    {
      atMs: Date.parse('2026-03-14T11:59:49.000Z'),
      action: 'tap chess-board g1-f3',
      outcome: 'started',
    },
  ],
};

/** The detail read for one Synthetic User; `overrides` shapes its state. */
export function userDetail(
  overrides: Partial<SyntheticUserDetail> = {}
): SyntheticUserDetail {
  return { ...userRow(1, 'bot_ada'), inspection: null, ...overrides };
}

export const REPLAY: SyntheticUserReplayResult = {
  scope: 'recorded-decision-policy',
  decisions: [
    {
      eventId: 'e1a2b3c4-0000-4000-8000-000000000003',
      createdAt: '2026-03-14T11:53:00.000Z',
      version: '2026.03.14-1',
      result: {
        selected: { activity: 'playing', targetControlId: 'chess-board' },
        matches: true,
      },
    },
    {
      eventId: 'e1a2b3c4-0000-4000-8000-000000000005',
      createdAt: '2026-03-14T11:55:00.000Z',
      version: '2026.03.14-1',
      result: {
        selected: { activity: 'browsing', targetControlId: null },
        matches: false,
      },
    },
    {
      eventId: 'e1a2b3c4-0000-4000-8000-000000000006',
      createdAt: '2026-03-14T11:56:00.000Z',
      version: null,
      result: null,
    },
  ],
};

/** The replay slot, before or after a replay. */
export function replay(
  result: SyntheticUserReplayResult | null
): () => JSX.Element {
  return () => (
    <SyntheticUserReplayView
      result={result}
      onReplay={fn(async () => undefined).mockName('replay.onReplay')}
    />
  );
}

/** One app online now; `overrides` shapes who and what. */
export function onlineEntry(
  index: number,
  username: string,
  overrides: Partial<OnlineNowEntryView> = {}
): OnlineNowEntryView {
  return {
    sessionId: `0c1d2e3f-0000-4000-8000-00000000000${index}`,
    kind: 'person',
    syntheticUserId: null,
    username,
    avatarConfig: null,
    accountId: `5a5a5a5a-0000-4000-8000-00000000000${index}`,
    place: 'spaces',
    activity: 'browsing',
    game: null,
    heartbeatAtMs: OBSERVED_AT_MS - 5_000,
    ...overrides,
  };
}

/** People and Synthetic Users online now, each doing something different. */
export const ONLINE_NOW: readonly OnlineNowEntryView[] = [
  onlineEntry(1, 'bob', {
    place: 'space',
    activity: 'looking',
    game: 'Chess',
  }),
  onlineEntry(2, 'carol', { place: 'settings' }),
  onlineEntry(3, 'cedar', {
    kind: 'synthetic',
    syntheticUserId: USERS[0]?.id ?? null,
    place: 'space',
    activity: 'playing',
    game: 'Connect Four',
  }),
  onlineEntry(4, 'maple', {
    kind: 'synthetic',
    syntheticUserId: USERS[1]?.id ?? null,
    place: 'people-search',
  }),
];

const ONLINE_NOW_VIEW: OnlineNowViewProps = {
  filter: 'everyone',
  entries: ONLINE_NOW,
  loading: false,
  failed: false,
  canWatch: true,
  canControl: true,
  onFilterChange: fn().mockName('onlineNow.onFilterChange'),
  onWatch: fn().mockName('onlineNow.onWatch'),
  onControlPanel: fn().mockName('onlineNow.onControlPanel'),
  onRetry: fn().mockName('onlineNow.onRetry'),
};

/** The online-now slot in a given state, as the container would fill it. */
export function onlineNow(
  overrides: Partial<OnlineNowViewProps> = {}
): () => JSX.Element {
  return () => <OnlineNowView {...ONLINE_NOW_VIEW} {...overrides} />;
}

/** A sanitized picture of a watched phone: Settings, its email redacted. */
export const FRAME_HTML = `<body><main style="padding:16px;font-family:sans-serif">
<h1>Settings</h1>
<p>Theme · System</p>
<p>Signed in as [redacted email]</p>
</main></body>`;
