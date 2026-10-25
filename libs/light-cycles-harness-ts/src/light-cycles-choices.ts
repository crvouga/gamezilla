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

const TARGET_INPUT = 'light-cycles-target-score';
const TARGET_APPLY = 'light-cycles-apply-target-score';
const TARGET_REFUSED = 'light-cycles-target-score-refused';

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

/** The game options, opened when the screen keeps them behind their disclosure. */
async function targetInputShown(s: ProductHarness, actor: string) {
  const ui = await actorUi(s, actor);
  if (
    !(await ui.get(TARGET_INPUT).isVisible()) &&
    (await ui.get('custom-game-options').isVisible())
  )
    await ui.get('custom-game-options').tap();
  return ui.get(TARGET_INPUT).isVisible();
}

/**
 * `actor` chooses the target score with the game options where their screen
 * offers them: types it and uses it, which the options allow only for a
 * whole number from 1 to 9. A screen without the options sends the choice
 * as a modified device would, so any refusal is the product's.
 */
export const chooseTargetScore = scenarioAction({
  name: 'chooseTargetScore',
  act: async (s, actor: string, target: number) => {
    if (!(await targetInputShown(s, actor))) {
      await chooseCustomGame(s, actor, {
        operation: 'rules',
        choice: String(target),
      });
      return;
    }
    const ui = await actorUi(s, actor);
    await ui.get(TARGET_INPUT).clear();
    await ui.get(TARGET_INPUT).input(String(target));
    await s.session.waitForIdle();
    if ((await ui.get(TARGET_APPLY).attribute('disabled')) !== null) return;
    await tapSettled(s, actor, TARGET_APPLY);
  },
});

/** Whether `actor`'s game options say the target score must be from 1 to 9. */
export async function targetScoreRefusalShown(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  return (await actorUi(s, actor)).get(TARGET_REFUSED).isVisible();
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
