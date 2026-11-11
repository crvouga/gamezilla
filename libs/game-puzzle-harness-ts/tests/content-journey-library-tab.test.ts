import { expect, test } from 'bun:test';
import {
  contentPlaceOf,
  contentTap,
  leaveContentStage,
} from '@libs/game-puzzle-harness-ts/content-journey-device';
import { journeyScreensDriver } from './journey-screens-driver';

const DRAFT = 'content-draft-ffcf8f02-68a8-421c-a9b8-f92873bbaa61';

const LIBRARY = {
  library: [
    'content-library',
    'content-library-tab-continue',
    'content-library-tab-browse',
    'content-library-tab-mine',
    'content-create-puzzle',
  ],
  mine: ['content-library', 'content-library-mine', DRAFT],
  browse: ['content-library', 'content-library-browse'],
  builder: ['content-author', 'content-author-steps', 'content-open-board'],
  board: [
    'content-author',
    'content-author-stage',
    'content-pack-order',
    'content-draft-save-status',
  ],
} as const;

const LEADS = {
  'library:content-library-tab-mine': 'mine',
  'library:content-library-tab-browse': 'browse',
  'mine:nav-back': 'library',
  'browse:nav-back': 'library',
  [`mine:${DRAFT}`]: 'builder',
  'builder:content-open-board': 'board',
  'builder:nav-back': 'library',
  'board:nav-back': 'builder',
  'board:content-pack-order': 'board',
};

// regression: numberlink-draft-hidden-library-tab — the draft was pressed
// while its tab's panel was hidden. The library's lists are screens of
// their own now: the journey opens My creations by its row, then the draft.
test('opens My creations by its row before the Numberlink draft listed there', async () => {
  const device = journeyScreensDriver({
    start: 'library',
    screens: LIBRARY,
    leads: LEADS,
  });
  await contentTap({ ui: device.ui, timeoutMs: 100 }, DRAFT);
  expect(device.taps).toEqual(['content-library-tab-mine', DRAFT]);
  expect(device.screen()).toBe('builder');
});

test('from another list, the journey goes Back to the hub before opening the right one', async () => {
  const device = journeyScreensDriver({
    start: 'browse',
    screens: LIBRARY,
    leads: LEADS,
  });
  await contentTap({ ui: device.ui, timeoutMs: 100 }, DRAFT);
  expect(device.taps).toEqual(['nav-back', 'content-library-tab-mine', DRAFT]);
});

test('a control on another builder screen is reached by its hub row, and leaving returns to the hub first', async () => {
  const device = journeyScreensDriver({
    start: 'builder',
    screens: LIBRARY,
    leads: LEADS,
  });
  await contentTap({ ui: device.ui, timeoutMs: 100 }, 'content-pack-order');
  expect(device.taps).toEqual(['content-open-board', 'content-pack-order']);
  await leaveContentStage({ ui: device.ui, timeoutMs: 100 });
  expect(device.taps.slice(2)).toEqual(['nav-back', 'nav-back']);
  expect(device.screen()).toBe('library');
});

test('each control is held by one small screen; shell and hub controls by none', () => {
  const held = (id: string) => contentPlaceOf(id);
  expect(held('content-published-r1')).toBe('browse');
  expect(held('content-more-published')).toBe('browse');
  expect(held('content-draft-d1')).toBe('mine');
  expect(held('content-attempt-a1')).toBe('continue');
  expect(held('content-title')).toBe('details');
  expect(held('content-pack-item-p1')).toBe('board');
  expect(held('content-undo-draft-edit')).toBe('board');
  expect(held('content-preview-puzzle-p1')).toBe('preview');
  expect(held('content-validate')).toBe('publish');
  expect(held('content-start-playtest')).toBe('publish');
  expect(held('content-use-copy-c1')).toBe('copies');
  expect(held('content-attempt-complete')).toBe('progress');
  expect(held('content-next-puzzle')).toBe('progress');
  expect(held('content-position-p1')).toBe('progress');
  for (const everywhere of [
    'content-draft-save-status',
    'content-position-save-status',
    'content-attempt-rules-changed',
    'content-withdraw-confirm',
    'content-author',
    'content-attempt',
    'content-preview',
    'content-restart',
    'content-pack-next',
    'content-pack-puzzle-r1',
    'numberlink-board-cell-1',
  ])
    expect(held(everywhere)).toBeNull();
});
