import { actorUi, pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import type { DriverKey } from '@pkgs/ui-testing-root-shared-ts/keys';
import {
  LIGHT_CYCLES_RIDER_NAMES,
  type LightCyclesDirection,
  type LightCyclesRiderName,
  lightCyclesBoardId,
} from './light-cycles-board-view';
import { personOf } from './light-cycles-lineup';

const SEATS = ['white', 'black', 'red', 'blue'] as const;
const STEERING_OFFERED_MS = 1000;
const ARROWS: Readonly<Record<string, DriverKey>> = {
  up: 'arrowUp',
  right: 'arrowRight',
  down: 'arrowDown',
  left: 'arrowLeft',
};
const LETTERS: Readonly<Record<string, DriverKey>> = {
  W: 'letterW',
  D: 'letterD',
  S: 'letterS',
  A: 'letterA',
};

/**
 * How someone steers: the direction pad (on a phone or anywhere), or one
 * key of the keyboard — an arrow named by its direction, or W, A, S or D.
 */
export type LightCyclesSteeringWay =
  | 'pad'
  | { readonly arrow: string }
  | { readonly letter: string };

export type LightCyclesSteer = {
  readonly rider: LightCyclesRiderName;
  readonly heading: LightCyclesDirection;
  /** The device steering: a person's own (default: the rider's person's). */
  readonly device?: string;
  readonly way?: LightCyclesSteeringWay;
};

/**
 * Someone steers a rider the way they choose, on the device they hold. A
 * device that offers no control for that rider takes no gesture, as a
 * person has nothing to press; a control that is shown but not offered
 * right now (disabled) takes nothing either.
 */
export async function steerRider(
  s: ProductHarness,
  steer: LightCyclesSteer
): Promise<boolean> {
  const device = steer.device ?? personOf(s, steer.rider);
  if (device === null) return false;
  const board = await lightCyclesBoardId(s, device);
  if (board === null) return false;
  const ui = await actorUi(s, device);
  const way = steer.way ?? 'pad';
  let steered = false;
  if (way === 'pad') {
    const seat = SEATS[LIGHT_CYCLES_RIDER_NAMES.indexOf(steer.rider)]!;
    const button = ui.get(`${board}-${seat}-pad-${steer.heading}`);
    steered =
      (await button.isVisible()) &&
      (await button.attribute('disabled')) === null;
    if (steered) await button.tap();
  } else {
    const key = 'arrow' in way ? ARROWS[way.arrow] : LETTERS[way.letter];
    if (key === undefined) throw new Error('No such steering key');
    await ui.get(`${board}-arena`).key(key);
    steered = true;
  }
  await s.session.waitForIdle();
  return steered;
}

/**
 * A rider's own person steers it, waiting for their device to offer it:
 * for a precondition, never a gesture the scenario is about.
 */
export async function steerWhenOffered(
  s: ProductHarness,
  steer: LightCyclesSteer
): Promise<void> {
  await pollUntil(s, async () => ((await steerRider(s, steer)) ? true : null), {
    maxMs: STEERING_OFFERED_MS,
    stepMs: 10,
    description: `steering ${steer.rider} ${steer.heading}`,
  });
}

export const steerLightCyclesRider = scenarioAction({
  name: 'steerLightCyclesRider',
  act: async (s, steer: LightCyclesSteer) => {
    await steerRider(s, steer);
  },
});

/** Turns chosen one right after the other, before the rider's next step. */
export const steerQuickly = scenarioAction({
  name: 'steerQuickly',
  act: async (
    s,
    rider: LightCyclesRiderName,
    headings: readonly LightCyclesDirection[]
  ) => {
    for (const heading of headings) await steerRider(s, { rider, heading });
  },
});
