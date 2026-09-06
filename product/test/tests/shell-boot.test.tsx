/**
 * Harness proof for the Solid in-process host: two actors boot through the
 * paint gate into the tab shell, the global menu navigates to Settings, DOM
 * snapshots are non-blank, and focus switches between actors.
 */

import { describe, expect, test } from 'bun:test';

import { openSim } from '../src/setup/open-sim';
import {
  actorHtml,
  actorIds,
  expectTabsVisible,
  focusActor,
  openSettings,
  spawnActor,
} from '../src/sim';

describe('shell boot', () => {
  test('two actors boot into the tab shell, open Settings, switch focus', async () => {
    await using s = await openSim('shell-boot');

    await s.apply(spawnActor, 'alice');
    await s.apply(expectTabsVisible, 'alice');
    await s.apply(spawnActor, 'bob');
    await s.apply(expectTabsVisible, 'bob');
    expect(await s.read(actorIds)).toEqual(['alice', 'bob']);

    await s.apply(openSettings, 'bob');
    const bobHtml = await s.read(actorHtml, 'bob');
    expect(bobHtml ?? '').toContain('data-screen="more"');

    await s.apply(focusActor, 'alice');
    await s.apply(expectTabsVisible, 'alice');
    const aliceHtml = await s.read(actorHtml, 'alice');
    expect(aliceHtml ?? '').toContain('data-screen="spaces"');
    expect(aliceHtml ?? '').not.toContain('data-screen="more"');

    await s.apply(focusActor, 'bob');
    const bobAgain = await s.read(actorHtml, 'bob');
    expect(bobAgain ?? '').toContain('data-screen="more"');
  });
});
