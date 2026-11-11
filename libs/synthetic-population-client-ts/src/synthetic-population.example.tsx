import type { SyntheticPopulationConfig } from '@libs/synthetic-population-shared-ts/config';
import type { Inspection } from '@libs/synthetic-population-shared-ts/inspection';
import type { Persona } from '@libs/synthetic-population-shared-ts/persona';
import { createJSXDecorator } from 'storybook-solidjs-vite';
import { type GameName, GameNamesProvider } from './game-names';
import type {
  SyntheticPopulationDirectoryPage,
  SyntheticPopulationEventView,
  SyntheticPopulationOverview,
  SyntheticUserDetail,
  SyntheticUserReplayResult,
} from './synthetic-population-api';

/** Story-only Synthetic Population panel fixtures: fixed ids and instants, no I/O. */

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

/** The space Tobi_plays is playing Connect Four in. */
const SPACE_ID = '8ee775b1-7215-448f-a21f-4101c16872dc';

function checkpoint(
  activity: NonNullable<UserRow['checkpoint']>['activity'],
  route: string
): NonNullable<UserRow['checkpoint']> {
  return {
    schemaVersion: 1,
    activity,
    route,
    spaceId: route === '/' ? null : SPACE_ID,
    matchId:
      activity === 'playing' ? '6151dde2-8f72-487f-81bd-5399c115702a' : null,
    pendingOperationId: null,
    policySeed: 'b6410d2b-f0d0-471d-a514-893d59222cef',
    decisions: 42,
    startedAtMs: Date.parse('2026-03-14T11:30:00.000Z'),
  };
}

/**
 * The games the fixtures' personas favor, named as the composition root
 * names registered games: platform stories never spell a real game's id.
 */
export const GAME_NAMES: readonly GameName[] = [
  { id: 'backgammon', title: 'Backgammon' },
  { id: 'checkers', title: 'Checkers' },
  { id: 'dominoes', title: 'Dominoes' },
  { id: 'go', title: 'Go' },
  { id: 'mancala', title: 'Mancala' },
  { id: 'reversi', title: 'Reversi' },
];

/** Story decorator: the games' names, as the composition root supplies them. */
export const withGameNames = createJSXDecorator((Story) => (
  <GameNamesProvider games={GAME_NAMES}>
    <Story />
  </GameNamesProvider>
));

/** A persona's avatar, serialized as provisioning writes it. */
export function face(style: string, seed: string): string {
  return JSON.stringify({ style, seed, options: {} });
}

/** Tobi_plays's persona, complete as provisioning records it. */
export const PERSONA: Persona = {
  schemaVersion: 2,
  username: 'Tobi_plays',
  avatar: face('adventurer', 'd930d20b4f83'),
  homeRegion: 'Berlin, DE',
  skillLevel: 'intermediate',
  favoriteGames: ['checkers', 'backgammon'],
  dailySchedule: { timeZone: 'Europe/Berlin', startHour: 11, endHour: 17 },
  thinkingTime: { minMs: 3_000, maxMs: 11_000 },
  rematchWeight: 0.62,
  hostingWeight: 0.21,
};

/** Each Synthetic User row's id, worker and persona, by row index. */
const USER_IDS: Readonly<Record<number, string>> = {
  1: '18294352-39a5-4cc7-a138-7de8e33c125a',
  2: 'b12c7e2b-2478-451a-a693-8d4ed2423dcb',
  3: 'b0e43213-4803-4048-9f10-0968fa39f10d',
  4: 'e5526c25-3f9f-445e-a0af-85d5030f0eec',
  5: '1020748f-96a2-4037-87d4-4fdbe773036c',
  6: '111f6c8b-81c7-4de1-bb47-26972f7a5db1',
  7: '157c289a-374a-44f0-bc1e-3cc6db8c370f',
};
const ACCOUNT_IDS: Readonly<Record<number, string>> = {
  1: '26ad4603-e4a3-4bb8-a33a-5be573cdb0a8',
  2: 'd825d930-1446-4d06-923c-1cb7d2e26fbf',
  3: 'c83f59b7-9e79-45c2-b92a-e8ec7fad8bad',
  4: 'd9febb2e-5864-4683-b6a4-7c17ce4e0065',
  5: '2245c7f5-f524-4c08-910f-6f211dc31a0a',
  6: 'e4d4419c-656c-480b-83b1-b89eb06af9f8',
  7: '71f17992-1272-425b-86af-5a7296212da8',
};

/** The workers' ids, as each worker process mints its own. */
export const WORKER_BERLIN = 'dcdc3377-16ce-4b49-94e3-898b11113b6f';
const WORKER_DRAINING = '072f36a0-24e7-40fd-90f9-8d78bb7d476f';
const WORKER_UNREACHABLE = '22628de4-3d3d-4ead-9c7d-e4f3f6d573f9';

/** One Synthetic User row; `overrides` shapes a particular state. */
export function userRow(
  index: number,
  username: string,
  overrides: Partial<UserRow> = {}
): UserRow {
  const persona = { ...PERSONA, username };
  return {
    id:
      USER_IDS[index] ??
      `5447c5be-a070-49ca-8c97-4823${String(index).padStart(8, '0')}`,
    account_id: ACCOUNT_IDS[index] ?? null,
    username,
    region: persona.homeRegion,
    paused: false,
    worker_id: WORKER_BERLIN,
    generation: 3,
    lease_until: '2026-03-14T12:01:00.000Z',
    activity: 'playing',
    checkpoint: checkpoint('playing', `/space/${SPACE_ID}`),
    application_version: '2026.03.14-1',
    last_action: 'testId("custom-game-board-column-4"): tap',
    last_error: null,
    inspection_requested_at: null,
    persona,
    created_at: '2026-03-01T09:00:00.000Z',
    updated_at: '2026-03-14T11:59:30.000Z',
    ...overrides,
  };
}

/**
 * Four Synthetic Users from three continents: one mid-game, one looking
 * for an opponent, one paused and one recorded before personas.
 */
export const USERS: readonly UserRow[] = [
  userRow(1, 'Tobi_plays'),
  userRow(2, 'quietpawn', {
    region: 'Toronto, CA',
    activity: 'matchmaking',
    checkpoint: checkpoint('matchmaking', `/space/${SPACE_ID}`),
    last_action: 'testId("multiplayer-find"): tap',
    persona: {
      ...PERSONA,
      username: 'quietpawn',
      avatar: face('notionists', '5f4e2124a33a'),
      homeRegion: 'Toronto, CA',
      skillLevel: 'strong',
      favoriteGames: ['reversi', 'checkers', 'go'],
      dailySchedule: {
        timeZone: 'America/Toronto',
        startHour: 6,
        endHour: 10,
      },
      thinkingTime: { minMs: 5_000, maxMs: 16_000 },
      rematchWeight: 0.35,
      hostingWeight: 0.18,
    },
  }),
  userRow(3, 'sam_ortega', {
    paused: true,
    region: 'Mexico City, MX',
    activity: 'browsing',
    checkpoint: checkpoint('browsing', '/'),
    last_action: 'testId("spaces-list-ready"): expect',
    persona: {
      ...PERSONA,
      username: 'sam_ortega',
      avatar: face('micah', 'e69767d43cd4'),
      homeRegion: 'Mexico City, MX',
      skillLevel: 'casual',
      favoriteGames: ['mancala'],
      dailySchedule: {
        timeZone: 'America/Mexico_City',
        startHour: 5,
        endHour: 9,
      },
      thinkingTime: { minMs: 2_000, maxMs: 9_000 },
      rematchWeight: 0.71,
      hostingWeight: 0.44,
    },
  }),
  userRow(4, 'pixel1987', {
    activity: 'recovering',
    region: 'Sydney, AU',
    worker_id: WORKER_DRAINING,
    last_error: 'Socket closed during move',
    // Recorded before personas: the directory falls back to its id.
    persona: null,
  }),
];

const EVENT_IDS: Readonly<Record<number, string>> = {
  1: '569248d6-0d7a-4234-9b62-21b55703cf76',
  2: 'd30a38a4-ef98-4efd-8a82-9f052a897f49',
  3: 'e6b749e4-f6b3-4424-adac-6c113af84f80',
  4: 'd5ea37bd-01f2-41bf-8622-2b3495f751df',
  5: 'f9877d2a-66f8-4c80-8021-e985d9fc0eb9',
  6: '781565d7-2718-4c4e-992a-8859a414a938',
};

function event(
  index: number,
  name: string,
  context: SyntheticPopulationEventView['context']
): SyntheticPopulationEventView {
  return {
    id: EVENT_IDS[index] ?? '',
    user_id: USERS[0]?.id ?? null,
    worker_id: WORKER_BERLIN,
    generation: 3,
    application_version: '2026.03.14-1',
    correlation_id: '36873bc0-5bf2-44fd-ae3f-7d9eadd927e1',
    event: name,
    context,
    created_at: `2026-03-14T11:5${index}:00.000Z`,
  };
}

export const EVENTS: readonly SyntheticPopulationEventView[] = [
  event(1, 'JoinedSpace', { spaceId: SPACE_ID }),
  event(2, 'GameStarted', { game: 'Connect Four', opponent: 'MayaK' }),
  event(3, 'DecisionSelected', { activity: 'playing', decisions: 42 }),
  event(4, 'MoveSubmitted', { column: 4, thinkingMs: 6_400 }),
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
    { activity: 'playing', region: 'Berlin, DE', count: 2 },
    { activity: 'playing', region: 'São Paulo, BR', count: 2 },
    { activity: 'playing', region: 'Tokyo, JP', count: 2 },
    { activity: 'matchmaking', region: 'Toronto, CA', count: 2 },
    { activity: 'matchmaking', region: 'Lagos, NG', count: 1 },
  ],
  users: [...USERS],
  workers: [
    worker(WORKER_BERLIN, {}),
    worker(WORKER_DRAINING, {
      draining: true,
      application_version: '2026.03.13-4',
    }),
    worker(WORKER_UNREACHABLE, {
      heartbeat_at: '2026-03-14T11:50:00.000Z',
      memory_bytes: null,
      cpu_milliseconds: null,
      lease_failures: 3,
    }),
  ],
  workerAssignments: [
    { worker_id: WORKER_BERLIN, count: 6 },
    { worker_id: WORKER_DRAINING, count: 2 },
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

/**
 * Live DOM capture for generation 3, Tobi_plays's turn in Connect Four:
 * the inspection keeps the accessible structure only (an excerpt).
 */
export const SNAPSHOT: Inspection = {
  capturedAtMs: Date.parse('2026-03-14T11:59:50.000Z'),
  generation: 3,
  route: `/space/${SPACE_ID}`,
  html: [
    '<html><head></head><body><div><div><div><h1>Connect Four</h1></div>',
    '<div data-testid="custom-game-content">',
    '  <section data-testid="custom-game-black"><span data-testid="custom-game-black-person"><span>MayaK</span></span></section>',
    '  <div role="group" aria-label="Connect Four board, seven columns and six rows" data-testid="custom-game-board">',
    '    <p data-testid="custom-game-board-prompt">Pick a column to drop your disc</p>',
    '    <button type="button" data-testid="custom-game-board-column-1" aria-label="Column 1, 0 of 6 occupied" aria-disabled="false"></button>',
    '    <button type="button" data-testid="custom-game-board-column-2" aria-label="Column 2, 1 of 6 occupied" aria-disabled="false"></button>',
    '    <button type="button" data-testid="custom-game-board-column-3" aria-label="Column 3, 2 of 6 occupied" aria-disabled="false"></button>',
    '    <button type="button" data-testid="custom-game-board-column-4" aria-label="Column 4, 3 of 6 occupied" aria-disabled="false"></button>',
    '  </div>',
    '  <section data-testid="custom-game-white"><span data-testid="custom-game-white-person"><span>Tobi_plays</span></span></section>',
    '  <button data-testid="custom-game-commands" type="button"><p>Game menu</p></button>',
    '</div></div></div></body></html>',
  ].join('\n'),
  state: '{"playing":"choosing"}',
  transitions: ['MOVE', 'COMPLETE', 'FAIL', 'RECOVER', 'STOP'],
  controls: [
    {
      testId: 'custom-game-board-column-3',
      role: 'button',
      name: 'Column 3, 2 of 6 occupied',
    },
    {
      testId: 'custom-game-board-column-4',
      role: 'button',
      name: 'Column 4, 3 of 6 occupied',
    },
    { testId: 'custom-game-commands', role: 'button', name: 'Game menu' },
  ],
  actions: [
    {
      atMs: Date.parse('2026-03-14T11:59:41.000Z'),
      action: 'testId("custom-game-board-column-3"): tap',
      outcome: 'completed',
    },
    {
      atMs: Date.parse('2026-03-14T11:59:49.000Z'),
      action: 'testId("custom-game-board-column-4"): tap',
      outcome: 'started',
    },
  ],
};

/** The detail read for one Synthetic User; `overrides` shapes its state. */
export function userDetail(
  overrides: Partial<SyntheticUserDetail> = {}
): SyntheticUserDetail {
  return { ...userRow(1, 'Tobi_plays'), inspection: null, ...overrides };
}

export const REPLAY: SyntheticUserReplayResult = {
  scope: 'recorded-decision-policy',
  decisions: [
    {
      eventId: EVENT_IDS[3] ?? '',
      createdAt: '2026-03-14T11:53:00.000Z',
      version: '2026.03.14-1',
      result: {
        selected: {
          activity: 'playing',
          targetControlId: 'custom-game-board-column-4',
        },
        matches: true,
      },
    },
    {
      eventId: EVENT_IDS[5] ?? '',
      createdAt: '2026-03-14T11:55:00.000Z',
      version: '2026.03.14-1',
      result: {
        selected: { activity: 'browsing', targetControlId: null },
        matches: false,
      },
    },
    {
      eventId: EVENT_IDS[6] ?? '',
      createdAt: '2026-03-14T11:56:00.000Z',
      version: null,
      result: null,
    },
  ],
};
