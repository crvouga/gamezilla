/**
 * Harness proof for the Solid in-process host: two actors boot through the
 * paint gate into the tab shell, the global menu navigates to Settings, DOM
 * snapshots are non-blank, and focus switches between actors.
 */

import { describe, expect, test } from 'bun:test';
import {
  actorHtml,
  actorIds,
  focusActor,
  openSettings,
  spawnActor,
  tabsVisible,
} from '@libs/sim-harness';
import { openSim } from './support/open-app-sim';

describe('shell boot', () => {
  test('two actors boot into the tab shell, open Settings, switch focus', async () => {
    await using s = await openSim('shell-boot');

    await s.apply(spawnActor, 'alice');
    await s.until((surf) => tabsVisible(surf, 'alice'));
    await s.apply(spawnActor, 'bob');
    await s.until((surf) => tabsVisible(surf, 'bob'));
    expect(await s.read(actorIds)).toEqual(['alice', 'bob']);

    await s.apply(openSettings, 'bob');
    const bobHtml = await s.read(actorHtml, 'bob');
    expect(bobHtml ?? '').toContain('data-screen="more"');

    await s.apply(focusActor, 'alice');
    await s.until((surf) => tabsVisible(surf, 'alice'));
    const aliceHtml = await s.read(actorHtml, 'alice');
    expect(aliceHtml ?? '').toContain('data-screen="spaces"');
    expect(aliceHtml ?? '').not.toContain('data-screen="more"');

    await s.apply(focusActor, 'bob');
    const bobAgain = await s.read(actorHtml, 'bob');
    expect(bobAgain ?? '').toContain('data-screen="more"');
  });
});
