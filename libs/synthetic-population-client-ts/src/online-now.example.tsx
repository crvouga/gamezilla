import type { JSX } from 'solid-js';
import { fn } from 'storybook/test';
import { SETTINGS_FRAME_HTML } from './live-watch-frames.example';
import { OnlineNowView, type OnlineNowViewProps } from './online-now-view';
import {
  face,
  OBSERVED_AT,
  PERSONA,
  USERS,
} from './synthetic-population.example';
import type { OnlineNowEntryView } from './synthetic-population-api';

/** Story-only Online now and Live watch fixtures: fixed ids, real faces. */

const OBSERVED_AT_MS = Date.parse(OBSERVED_AT);

/** Each app's session and account, by entry index. */
const SESSIONS: Readonly<Record<number, readonly [string, string]>> = {
  1: [
    '0e7fedd8-5356-45d7-bee9-54bcdc1eec0f',
    'cb397e88-99a0-4f95-8578-e3f8ab28999c',
  ],
  2: [
    'a4eaf76f-d73d-44ed-8823-5ffe193c7085',
    'db0aced3-4e62-433e-828a-ffacea33dd4e',
  ],
  3: [
    '6dec637c-abd1-4111-86a3-6c81a72abdb4',
    '2ecb14cd-ffce-4e22-8ead-2053a27441f1',
  ],
  4: [
    '33828fa1-a1c7-4aca-9cb7-19767390fc9e',
    '26ad4603-e4a3-4bb8-a33a-5be573cdb0a8',
  ],
  5: [
    'fca12320-9452-4c6f-a62e-1103746a8ef0',
    'd825d930-1446-4d06-923c-1cb7d2e26fbf',
  ],
  6: [
    'a425a3f9-128e-4735-a9d9-2ba61b191bfb',
    'c83f59b7-9e79-45c2-b92a-e8ec7fad8bad',
  ],
  7: [
    'f4706f77-e3d7-4fb4-87e4-c03b0d74808c',
    '43923a12-91b0-4590-acbf-c482f7cf4bf6',
  ],
  8: [
    'cb397e88-99a0-4f95-8578-e3f8ab28999d',
    'f4706f77-e3d7-4fb4-87e4-c03b0d74808d',
  ],
};

/** One app online now; `overrides` shapes who and what. */
export function onlineEntry(
  index: number,
  username: string,
  overrides: Partial<OnlineNowEntryView> = {}
): OnlineNowEntryView {
  const [sessionId, accountId] = SESSIONS[index] ?? [
    `e45f2336-af33-4a70-a713-${String(index).padStart(12, '0')}`,
    `f9877d2a-66f8-4c80-8021-${String(index).padStart(12, '0')}`,
  ];
  return {
    sessionId,
    kind: 'person',
    syntheticUserId: null,
    paused: false,
    username,
    avatarConfig: null,
    accountId,
    place: 'spaces',
    activity: 'browsing',
    game: null,
    heartbeatAtMs: OBSERVED_AT_MS - 5_000,
    ...overrides,
  };
}

/** LenaPlays, the Synthetic User watched browsing Spaces. */
const LENA_ID = 'e45f2336-af33-4a70-a713-b2138f9ac70a';

/**
 * People and Synthetic Users online now, mixed as they come: looking for
 * an opponent, in Settings, browsing Spaces, mid-game, paused in people
 * search, on a profile. Each wears their own face; KofiGG's profile has
 * not synced, so shows initials.
 */
export const ONLINE_NOW: readonly OnlineNowEntryView[] = [
  onlineEntry(1, 'maria_k', {
    avatarConfig: face('funEmoji', 'cb397e88-99a0-4f95-8578-e3f8ab28999c'),
    place: 'space',
    activity: 'looking',
    game: 'Connect Four',
  }),
  onlineEntry(2, 'nightowl_88', {
    avatarConfig: face('avataaars', '44aec88fd6f9'),
    place: 'settings',
  }),
  onlineEntry(3, 'LenaPlays', {
    kind: 'synthetic',
    syntheticUserId: LENA_ID,
    avatarConfig: face('personas', 'c6783a6df92e'),
  }),
  onlineEntry(4, 'Tobi_plays', {
    kind: 'synthetic',
    syntheticUserId: USERS[0]?.id ?? null,
    avatarConfig: PERSONA.avatar,
    place: 'space',
    activity: 'playing',
    game: 'Connect Four',
  }),
  onlineEntry(5, 'quietpawn', {
    kind: 'synthetic',
    syntheticUserId: USERS[1]?.id ?? null,
    avatarConfig: USERS[1]?.persona?.avatar ?? null,
    place: 'space',
    activity: 'looking',
    game: 'Quoridor',
  }),
  onlineEntry(6, 'sam_ortega', {
    kind: 'synthetic',
    syntheticUserId: USERS[2]?.id ?? null,
    avatarConfig: USERS[2]?.persona?.avatar ?? null,
    paused: true,
    place: 'people-search',
  }),
  onlineEntry(7, 'KofiGG', {
    place: 'space',
    activity: 'playing',
    game: 'Hearts',
  }),
  onlineEntry(8, 'Lucia_m', {
    avatarConfig: face('lorelei', '8b3a174dac0b'),
    place: 'profile',
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

/** A sanitized picture of a watched phone: nightowl_88 in Settings. */
export const FRAME_HTML = SETTINGS_FRAME_HTML;

export { SPACES_FRAME_HTML } from './live-watch-frames.example';
