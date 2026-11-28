import type { GameSessionInput } from '@libs/game-session-shared-ts/game-session-choice';
import { gameSessionStartable } from '@libs/game-session-shared-ts/game-session-state';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { controlIsEnabled } from '@pkgs/ui-testing-root-shared-ts/control-is-enabled';
import { showGameSessions } from './game-navigation';
import {
  openGameSessionPlace,
  showGameSessionHome,
} from './game-session-places';
import type { GameSessionProbe } from './game-session-probe';
import { readGameSessionProbe } from './game-session-probe';
import {
  chooseGameSession,
  waitGameSessionSettled,
  withKnownSetup,
} from './game-session-ui';
import { isTurnHarnessGame } from './harness-game';
import { harnessGameAt } from './harness-game-of';
import { keepsOwnPrivateSetup } from './own-private-setups';
import { dealKnownHandsOnStart } from './room-draws';

/** The game-session control a person uses for `input`. */
function gameSessionControl(input: GameSessionInput): string {
  if ('side' in input) return `game-session-${input.side}-${input.operation}`;
  switch (input.operation) {
    case 'create':
      return 'game-session-create';
    case 'rematch':
      return 'game-session-rematch';
    case 'unready':
      return 'game-session-ready';
    case 'move':
      return 'game-session-board';
    case 'claimWin':
      return 'game-session-claim-win';
    default:
      return `game-session-${input.operation}`;
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
function placeRow(input: GameSessionInput, probe: GameSessionProbe): string {
  if ('side' in input && SEAT_PLACE_OPERATIONS.includes(input.operation))
    return `game-session-${input.side}-choices`;
  if (CLOCK_PLACE_OPERATIONS.includes(input.operation))
    return 'game-session-options';
  if (
    GAME_MENU_OPERATIONS.includes(input.operation) &&
    probe.current?.status === 'active'
  )
    return 'game-session-commands';
  // Becoming ready with a private setup happens on the setup's own place.
  if (input.operation === 'ready' && probe.privateSetup !== null)
    return 'game-session-setup-open';
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
  input: GameSessionInput,
  probe: GameSessionProbe
): Promise<void> {
  const ui = await actorUi(s, actor);
  const row = placeRow(input, probe);
  const target = gameSessionControl(input);
  if (
    input.operation === 'create' &&
    (await ui.get('game-session-new').isVisible())
  ) {
    await ui.get('game-session-new').tap();
  } else if (row === '') await showGameSessionHome(s, actor);
  else await openGameSessionPlace(s, actor, row, target);
  if (
    input.operation === 'clock' &&
    (await ui.get('game-session-minutes').isVisible())
  ) {
    await ui.get('game-session-minutes').clear();
    await ui.get('game-session-minutes').input(String(input.minutes));
    await ui.get('game-session-increment').clear();
    await ui.get('game-session-increment').input(String(input.increment));
  }
}

function confirmUnavailable(
  probe: GameSessionProbe,
  input: GameSessionInput
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
  probe: GameSessionProbe,
  input: GameSessionInput
): boolean {
  const ready =
    probe.mySide !== null &&
    probe.current?.ready.includes(probe.mySide) === true;
  return (
    (probe.current === null && input.operation !== 'create') ||
    input.operation === 'invite' ||
    input.operation === 'move' ||
    (input.operation === 'ready' && ready) ||
    (input.operation === 'unready' && !ready) ||
    (input.operation === 'start' &&
      (probe.current === null || !gameSessionStartable(probe.current))) ||
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
  input: GameSessionInput,
  probe: GameSessionProbe
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
  await arrange(await actorUi(s, actor), 'game-session-setup', setup);
}

/**
 * Make one game-session choice with the screen's own controls where it offers
 * them (confirming a cancel or resignation), otherwise as a modified device
 * would, so a refusal is always the product's. Moves are the game's own
 * board gesture (`makeGameSessionMove`).
 */
export async function operateGameSessionControls(
  s: ProductHarness,
  actor: string,
  input: GameSessionInput
): Promise<void> {
  const probe = await readGameSessionProbe(s, actor);
  if (probe === null) throw new Error(`${actor} sees no game session screen`);
  const target = gameSessionControl(input);
  if (needsModifiedDevice(probe, input)) {
    await chooseGameSession(s, actor, input);
    return;
  }
  await revealControl(s, actor, input, probe);
  if (!(await controlUsable(s, actor, target))) {
    // The place offers no such control now: back to where the game opens,
    // then the choice as a modified device would send it.
    await showGameSessionHome(s, actor);
    await chooseGameSession(s, actor, input);
    return;
  }
  await arrangeSetup(s, actor, input, probe);
  await dealKnownHandsOnStart(s, actor, input.operation);
  const ui = await actorUi(s, actor);
  await ui.get(target).tap();
  if (input.operation === 'cancel' || input.operation === 'resign')
    await ui.get(`${target}-confirm`).tap();
  const refusal = await waitGameSessionSettled(s, actor, probe.settled);
  if (input.operation === 'offer' && refusal === '') {
    // The room can acknowledge the offer before the sheet finishes closing.
    await ui.get('game-session-resume').expect.hidden();
    return;
  }
  if (
    (input.operation === 'cancel' || input.operation === 'resign') &&
    (await ui.get(`${target}-done`).isVisible())
  )
    await ui.get(`${target}-done`).tap();
  // A refused choice leaves the person on the place they made it from.
  await showGameSessionHome(s, actor);
}

/** One game-session choice, made as {@link operateGameSessionControls} does. */
export const operateGameSession = scenarioAction({
  name: 'operateGameSession',
  act: operateGameSessionControls,
});

/**
 * `actor` creates a game session of `gameId` in `host`'s space: the host
 * brings the space to the game's game sessions, anyone else follows them
 * there, and `actor` asks for a new game session as the screen offers it.
 */
export const createGameSessionIn = scenarioAction({
  name: 'createGameSessionIn',
  act: async (s, gameId: string, host: string, actor: string) => {
    await showGameSessions(s, host, gameId);
    if (actor !== host) await showGameSessions(s, actor, gameId);
    await operateGameSessionControls(s, actor, {
      operation: 'create',
      mode: 'vs-human',
    });
  },
});
