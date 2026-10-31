import { operateCustomGameControls } from '@libs/game-session-harness-ts/custom-game-controls';
import {
  readCustomGameRefusal,
  readCustomGameScreen,
} from '@libs/game-session-harness-ts/custom-game-screen';
import { chooseCustomGame } from '@libs/game-session-harness-ts/custom-game-ui';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import {
  LIGHT_CYCLES_RIDER_NAMES,
  type LightCyclesRiderName,
} from './light-cycles-board-view';
import {
  LIGHT_CYCLES_SIDES,
  type LightCyclesBotLevel,
  lightCyclesLineup,
  rememberLineup,
} from './light-cycles-lineup';

/** The frame's generic stepper for the game's `target-score` option. */
const TARGET = 'custom-game-option-target-score';
const TARGET_VALUE = `${TARGET}-value`;
const TARGET_RANGE = `${TARGET}-range`;

const SETTLED_MS = 5000;

/** A control was used: time runs until the custom game takes the choice or refuses it. */
async function tapSettled(s: ProductHarness, actor: string, control: string) {
  const before = (await readCustomGameScreen(s, actor))?.current?.revision;
  await (await actorUi(s, actor)).get(control).tap();
  await pollUntil(
    s,
    async () => {
      const screen = await readCustomGameScreen(s, actor);
      return screen?.current?.revision !== before || screen?.error !== ''
        ? true
        : null;
    },
    { maxMs: SETTLED_MS, stepMs: 25, description: `${actor}'s choice settled` }
  );
}

/** The target score the stepper shows and the range it offers. */
async function readTargetStepper(s: ProductHarness, actor: string) {
  const value = (await actorUi(s, actor)).get(TARGET_VALUE);
  const number = async (name: string) => Number(await value.attribute(name));
  return {
    value: await number('aria-valuenow'),
    min: await number('aria-valuemin'),
    max: await number('aria-valuemax'),
  };
}

/**
 * `actor` chooses the target score with the game options where their screen
 * offers them: steps it one round win at a time to `target`, each step
 * taken before the next. The stepper offers only 1 to 9, so a target
 * outside that range is never chosen, and the range under it says why. A
 * screen without the stepper (someone who only reads the options, or a game
 * already started) sends the choice as a modified device would, so any
 * refusal is the product's.
 */
export const chooseTargetScore = scenarioAction({
  name: 'chooseTargetScore',
  act: async (s, actor: string, target: number) => {
    if (!(await (await actorUi(s, actor)).get(TARGET_VALUE).isVisible())) {
      await chooseCustomGame(s, actor, {
        operation: 'rules',
        choice: String(target),
      });
      return;
    }
    let shown = await readTargetStepper(s, actor);
    if (target < shown.min || target > shown.max) return;
    while (shown.value !== target) {
      await tapSettled(
        s,
        actor,
        `${TARGET}-${target > shown.value ? 'increase' : 'decrease'}`
      );
      const next = await readTargetStepper(s, actor);
      // A step the product refused leaves the value where it was.
      if (next.value === shown.value) return;
      shown = next;
    }
  },
});

/** Whether `actor`'s game options say the target score must be from 1 to 9. */
export async function targetScoreRefusalShown(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  const range = (await actorUi(s, actor)).get(TARGET_RANGE);
  return (
    (await range.isVisible()) &&
    ((await range.text()) ?? '').includes('from 1 to 9')
  );
}

/**
 * `actor` chooses a bot at `level` to ride `rider`: the seat's bot choice,
 * then its level, with the screen's controls where it offers them.
 */
export const chooseBot = scenarioAction({
  name: 'chooseBot',
  act: async (
    s,
    actor: string,
    rider: LightCyclesRiderName,
    level: LightCyclesBotLevel
  ) => {
    const index = LIGHT_CYCLES_RIDER_NAMES.indexOf(rider);
    const side = LIGHT_CYCLES_SIDES[index]!;
    await operateCustomGameControls(s, actor, { operation: 'bot', side });
    const button = `custom-${side}-difficulty-${level}`;
    if (await (await actorUi(s, actor)).get(button).isVisible())
      await tapSettled(s, actor, button);
    else
      await chooseCustomGame(s, actor, {
        operation: 'difficulty',
        side,
        difficulty: level,
      });
    // The scenario now knows a bot rides it, when the choice was taken.
    if ((await readCustomGameRefusal(s, actor)) === '') {
      const lineup = lightCyclesLineup(s);
      const seats = [...lineup.seats];
      seats[index] = { bot: level };
      rememberLineup(s, { ...lineup, seats });
    }
  },
});

/** What `actor` was last told was refused: the product's reason, `''` for none. */
export async function refusalTold(
  s: ProductHarness,
  actor: string
): Promise<string> {
  return (await readCustomGameRefusal(s, actor)) ?? '';
}
