import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
import { customGameStartable } from '@libs/game-session-shared-ts/custom-game-state';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { controlIsEnabled } from '@pkgs/ui-testing-root-shared-ts/control-is-enabled';
import { openCustomGamePlace, showCustomGameHome } from './custom-game-places';
import type { CustomGameProbe } from './custom-game-probe';
import { readCustomGameProbe } from './custom-game-probe';
import {
  chooseCustomGame,
  waitCustomGameSettled,
  withKnownSetup,
} from './custom-game-ui';
import { showCustomGames } from './game-navigation';
import { isTurnHarnessGame } from './harness-game';
import { harnessGameAt } from './harness-game-of';
import { keepsOwnPrivateSetup } from './own-private-setups';
import { dealKnownHandsOnStart } from './room-draws';

/** The custom-game control a person uses for `input`. */
export function customGameControl(
  input: CustomGameInput,
  probe: CustomGameProbe
): string {
  if ('side' in input) return `custom-game-${input.side}-${input.operation}`;
  switch (input.operation) {
    case 'create':
      return probe.current === null ? 'custom-game-create' : 'custom-game-new';
    case 'rematch':
      return 'custom-game-rematch';
    case 'unready':
      return 'custom-game-ready';
    case 'move':
      return 'custom-game-board';
    case 'claimWin':
      return 'custom-game-claim-win';
    default:
      return `custom-game-${input.operation}`;
  }
}

/** The choices about one seat that sit on that seat's own place. */
const SEAT_PLACE_OPERATIONS: readonly string[] = [
  'take',
  'bot',
  'local',
  'open',
  'close',
  'release',
  'claim',
  'revoke',
];

/** The choices that sit on the clock's place. */
const CLOCK_PLACE_OPERATIONS: readonly string[] = ['swap', 'clock', 'untimed'];

/** The commands of a game being played that sit in its game menu. */
const GAME_MENU_OPERATIONS: readonly string[] = ['offer', 'resign', 'cancel'];

/** The row on the home place that opens the place holding `input`'s control. */
function placeRow(input: CustomGameInput, probe: CustomGameProbe): string {
  if ('side' in input && SEAT_PLACE_OPERATIONS.includes(input.operation))
    return `custom-game-${input.side}-choices`;
  if (CLOCK_PLACE_OPERATIONS.includes(input.operation))
    return 'custom-game-options';
  if (
    GAME_MENU_OPERATIONS.includes(input.operation) &&
    probe.current?.status === 'active'
  )
    return 'custom-game-commands';
  // Becoming ready with a private setup happens on the setup's own place.
  if (input.operation === 'ready' && probe.privateSetup !== null)
    return 'custom-game-setup-open';
  return '';
}

/**
 * Open the place a control sits on, as a person does: the seat's own place,
 * the clock, the game menu or the private setup, by its row on the home
 * place. A control on the home place is reached by going back to it.
 */
async function revealControl(
  s: ProductHarness,
  actor: string,
  input: CustomGameInput,
  probe: CustomGameProbe
): Promise<void> {
  const ui = await actorUi(s, actor);
  const row = placeRow(input, probe);
  const target = customGameControl(input, probe);
  if (row === '') await showCustomGameHome(s, actor);
  else await openCustomGamePlace(s, actor, row, target);
  if (
    input.operation === 'clock' &&
    (await ui.get('custom-game-minutes').isVisible())
  ) {
    await ui.get('custom-game-minutes').clear();
    await ui.get('custom-game-minutes').input(String(input.minutes));
    await ui.get('custom-game-increment').clear();
    await ui.get('custom-game-increment').input(String(input.increment));
  }
}

function confirmUnavailable(
  probe: CustomGameProbe,
  input: CustomGameInput
): boolean {
  if (input.operation !== 'cancel' && input.operation !== 'resign')
    return false;
  if (!probe.connected || probe.current === null) return true;
  if (input.operation === 'resign')
    return (
      probe.current.status !== 'active' ||
      probe.mySide === null ||
      !probe.gates['play']
    );
  return (
    !['configuring', 'active'].includes(probe.current.status) ||
    !probe.gates['cancel']
  );
}

/**
 * Whether the screen cannot express `input` as a control would (an invite
 * picks a person; readiness the person already has; a start that is not
 * possible yet; a move), so it is sent as a modified device would.
 */
function needsModifiedDevice(
  probe: CustomGameProbe,
  input: CustomGameInput
): boolean {
  const ready =
    probe.mySide !== null &&
    probe.current?.ready.includes(probe.mySide) === true;
  return (
    input.operation === 'invite' ||
    input.operation === 'move' ||
    (input.operation === 'ready' && ready) ||
    (input.operation === 'unready' && !ready) ||
    (input.operation === 'start' &&
      (probe.current === null || !customGameStartable(probe.current))) ||
    confirmUnavailable(probe, input)
  );
}

async function controlUsable(
  s: ProductHarness,
  actor: string,
  target: string
): Promise<boolean> {
  const ui = await actorUi(s, actor);
  if (!(await ui.get(target).isVisible())) return false;
  // A disabled control takes no choice (a private setup still incomplete).
  if (
    !controlIsEnabled(
      await ui.get(target).attribute('disabled'),
      await ui.get(target).attribute('aria-disabled')
    )
  )
    return false;
  // A control still showing its last success takes no new choice yet.
  const button = (await ui.snapshotHtml())?.match(
    new RegExp(`<button[^>]*data-testid="${target}"[^>]*>`)
  )?.[0];
  return button?.includes('data-phase="success"') !== true;
}

/**
 * Before becoming ready in a game with private setups, arrange the setup on
 * the game's own setup board with its gesture, as a person does.
 */
async function arrangeSetup(
  s: ProductHarness,
  actor: string,
  input: CustomGameInput,
  probe: CustomGameProbe
): Promise<void> {
  if (
    input.operation !== 'ready' ||
    probe.current === null ||
    keepsOwnPrivateSetup(s, actor)
  )
    return;
  const ready = await withKnownSetup(s, actor, input);
  const setup = ready.operation === 'ready' ? ready.setup : undefined;
  const game = harnessGameAt(s, probe.current.fen);
  const arrange = isTurnHarnessGame(game)
    ? game.shared.automation.turns.arrange
    : undefined;
  if (setup === undefined || arrange === undefined) return;
  await arrange(await actorUi(s, actor), 'custom-game-setup', setup);
}

/**
 * Make one custom-game choice with the screen's own controls where it offers
 * them (confirming a cancel or resignation), otherwise as a modified device
 * would, so a refusal is always the product's. Moves are the game's own
 * board gesture (`makeCustomGameMove`).
 */
export async function operateCustomGameControls(
  s: ProductHarness,
  actor: string,
  input: CustomGameInput
): Promise<void> {
  const probe = await readCustomGameProbe(s, actor);
  if (probe === null) throw new Error(`${actor} sees no custom game screen`);
  const target = customGameControl(input, probe);
  if (needsModifiedDevice(probe, input)) {
    await chooseCustomGame(s, actor, input);
    return;
  }
  await revealControl(s, actor, input, probe);
  if (!(await controlUsable(s, actor, target))) {
    // The place offers no such control now: back to where the game opens,
    // then the choice as a modified device would send it.
    await showCustomGameHome(s, actor);
    await chooseCustomGame(s, actor, input);
    return;
  }
  await arrangeSetup(s, actor, input, probe);
  await dealKnownHandsOnStart(s, actor, input.operation);
  const ui = await actorUi(s, actor);
  await ui.get(target).tap();
  if (input.operation === 'cancel' || input.operation === 'resign')
    await ui.get(`${target}-confirm`).tap();
  await waitCustomGameSettled(s, actor, probe.settled);
  if (
    (input.operation === 'cancel' || input.operation === 'resign') &&
    (await ui.get(`${target}-done`).isVisible())
  )
    await ui.get(`${target}-done`).tap();
  // A refused choice leaves the person on the place they made it from.
  await showCustomGameHome(s, actor);
}

/** One custom-game choice, made as {@link operateCustomGameControls} does. */
export const operateCustomGame = scenarioAction({
  name: 'operateCustomGame',
  act: operateCustomGameControls,
});

/**
 * `actor` creates a custom game of `gameId` in `host`'s space: the host
 * brings the space to the game's custom games, anyone else follows them
 * there, and `actor` asks for a new custom game as the screen offers it.
 */
export const createCustomGameIn = scenarioAction({
  name: 'createCustomGameIn',
  act: async (s, gameId: string, host: string, actor: string) => {
    await showCustomGames(s, host, gameId);
    if (actor !== host) await showCustomGames(s, actor, gameId);
    await operateCustomGameControls(s, actor, { operation: 'create' });
  },
});
