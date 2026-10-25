import { openCustomGames } from '@libs/game-session-harness-ts/game-navigation';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront } from '@libs/harness-ts/observations';
import { otherDevice } from '@libs/harness-ts/platform';
import { joinViaLink } from '@libs/spaces-harness-ts/space-actions';
import { readSpaceLink } from '@libs/spaces-harness-ts/spaces-ui-reads';
import { lightCyclesBoardId } from './light-cycles-board-view';
import {
  lightCyclesGameId,
  lightCyclesLineup,
  startedLightCycles,
} from './light-cycles-lineup';

const riding = new WeakMap<ProductHarness, Map<string, string>>();

/** The device `person` rides from now: their first, unless they switched. */
export function ridingDevice(s: ProductHarness, person: string): string {
  return riding.get(s)?.get(person) ?? person;
}

/** `person`'s first device, or their other one. */
export function deviceOf(person: string, which: 'first' | 'other'): string {
  return which === 'first' ? person : otherDevice(person);
}

/**
 * `person` carries on from their other device (or back from it to the
 * first): they open the game there, the space's link on a device that has
 * not shown it yet, and ride from it where the board offers that.
 */
export const switchDevices = scenarioAction({
  name: 'switchDevices',
  act: async (s, person: string) => {
    await startedLightCycles(s);
    const from = ridingDevice(s, person);
    const to = from === person ? otherDevice(person) : person;
    const { host, count } = lightCyclesLineup(s);
    if ((await lightCyclesBoardId(s, to)) === null) {
      const link = await readSpaceLink(s, host);
      if (link === null) throw new Error(`${host} has no space link`);
      await Promise.resolve(joinViaLink.act(s, to, link));
      await Promise.resolve(
        openCustomGames.act(s, to, lightCyclesGameId(count))
      );
    }
    await bringToFront(s, to);
    const board = await lightCyclesBoardId(s, to);
    const ride = (await actorUi(s, to)).get(`${board ?? ''}-ride-here`);
    if (board !== null && (await ride.isVisible())) await ride.tap();
    await s.session.waitForIdle();
    const devices = riding.get(s) ?? new Map<string, string>();
    devices.set(person, to);
    riding.set(s, devices);
  },
});
