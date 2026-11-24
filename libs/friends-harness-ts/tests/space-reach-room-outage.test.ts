import { expect, test } from 'bun:test';
import { letTimePass } from '@libs/harness-ts/actions';
import { focusActor } from '@libs/harness-ts/shell-actions';
import { createSpace } from '@libs/spaces-harness-ts/space-actions';
import {
  cutRoomConnection,
  restoreRoomConnection,
} from '@libs/spaces-harness-ts/space-unreachable';
import {
  activeSpaceVisible,
  spaceUnreachableShown,
} from '@libs/spaces-harness-ts/spaces-ui-reads';
import { openHarness } from './open-friends-harness';

/** Longer than the wait before a device asks after its space, several times over. */
const OUTAGE_MS = 45_000;
const STEP_MS = 5_000;

test('a host whose room connection stays down while online is never told their space cannot be reached', async () => {
  // regression: space-unreachable-while-room-reconnects
  await using s = await openHarness();
  await s.apply(focusActor, 'alice');
  await s.apply(createSpace, 'alice');
  expect(await s.read(activeSpaceVisible, 'alice')).toBe(true);

  await s.apply(cutRoomConnection, 'alice');
  for (let waited = 0; waited < OUTAGE_MS; waited += STEP_MS) {
    await s.apply(letTimePass, STEP_MS);
    expect(await s.read(spaceUnreachableShown, 'alice')).toBe(false);
    expect(await s.read(activeSpaceVisible, 'alice')).toBe(true);
  }

  await s.apply(restoreRoomConnection, 'alice');
  await s.apply(letTimePass, STEP_MS);
  expect(await s.read(spaceUnreachableShown, 'alice')).toBe(false);
  expect(await s.read(activeSpaceVisible, 'alice')).toBe(true);
}, 120_000);
