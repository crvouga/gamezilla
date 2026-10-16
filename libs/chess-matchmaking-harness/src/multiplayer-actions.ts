import {
  forgetMultiplayerReply,
  sendMultiplayerCommand,
} from '@libs/game-matchmaking-harness/multiplayer-commands';
import {
  refreshMultiplayerConnection,
  setMultiplayerConnection,
} from '@libs/game-matchmaking-harness/multiplayer-connection';
import { multiplayerView } from '@libs/game-matchmaking-harness/multiplayer-reads';
import { multiplayerSpaceId } from '@libs/game-matchmaking-harness/multiplayer-spaces';
import { timeControlKey } from '@libs/game-matchmaking-shared/time-control';
import {
  actorUi,
  ensureActor,
  pollUntil,
  scenarioAction,
} from '@libs/harness/actor-ui';
import { ChessBoardFlows } from '@pkgs/chess-board-core-shared/flows';
import { chessBoardSquareTestId } from '@pkgs/chess-board-core-shared/probe';
import type { Square } from '@pkgs/chess-board-core-shared/types';
import {
  multiplayerArrivalIsTerminal,
  reachMultiplayerChoices,
} from './multiplayer-navigation';
import { multiplayerWatcherBoard } from './multiplayer-watchers';

/** Chess was chosen for this space, so multiplayer is one tap in. */
async function multiplayerMenuOpened(
  ui: Awaited<ReturnType<typeof actorUi>>
): Promise<boolean> {
  try {
    await ui.get('chess-menu-multiplayer').expect.visible({ timeoutMs: 5000 });
    return true;
  } catch {
    return false;
  }
}

export const openMultiplayerChess = scenarioAction({
  name: 'openMultiplayerChess',
  act: async (s, actor: string, gameId?: string, keyboard = false) => {
    await ensureActor(s, actor);
    const ui = await actorUi(s, actor);
    await ui.get('status-current-user').expect.visible();
    const spaceId = await multiplayerSpaceId(s, actor);
    if (spaceId === null) return;
    const path = await s.actors.get(actor)!.currentPath();
    if (!path.includes(spaceId))
      await s.actors.get(actor)!.openLink(`/space/${spaceId}`);
    await s.session.waitForIdle();
    const surface = await reachMultiplayerChoices(s, actor);
    if (multiplayerArrivalIsTerminal(surface)) return;
    if (surface === 'game-menu-chess') {
      await ui.get('game-menu-chess').tap();
      // A guest's space has not chosen chess, so the menu never opens.
      // The caller sends the same command a stale screen would.
      if (!(await multiplayerMenuOpened(ui))) return;
    }
    if (await ui.get('chess-menu-multiplayer').isVisible()) {
      if (keyboard) await ui.get('chess-menu-multiplayer').key('enter');
      else await ui.get('chess-menu-multiplayer').tap();
    }
    await s.session.waitForIdle();
    await pollUntil(
      s,
      async () =>
        (await multiplayerChessOpen(s, actor, ui, gameId)) ? true : null,
      { maxMs: 5000, description: 'multiplayer chess inside the space' }
    );
  },
});

const OPEN_SURFACES = [
  'multiplayer-access-denial',
  'multiplayer-game',
  'multiplayer-waiting',
  'multiplayer-find',
  'multiplayer-unavailable',
] as const;

/**
 * The space's multiplayer screen is up. A guest sees the host's search, so
 * the person's own search does not choose which surface must be visible.
 */
async function multiplayerChessOpen(
  s: Parameters<typeof multiplayerWatcherBoard>[0],
  actor: string,
  ui: Awaited<ReturnType<typeof actorUi>>,
  gameId: string | undefined
): Promise<boolean> {
  if (gameId === undefined) {
    for (const id of OPEN_SURFACES) {
      if (await ui.get(id).isVisible()) return true;
    }
  }
  if (await ui.get('multiplayer-access-denial').isVisible()) return true;
  const rendered = await multiplayerWatcherBoard(s, actor);
  if (
    rendered.gameId !== null &&
    (gameId === undefined || rendered.gameId === gameId)
  )
    return true;
  const view = await multiplayerView(s, actor);
  const target =
    gameId !== undefined && view.game?.id !== gameId
      ? 'multiplayer-unavailable'
      : 'multiplayer-game';
  return gameId === undefined ? false : ui.get(target).isVisible();
}

/**
 * Choose a time control on the screen, then find an opponent at it. A screen
 * that cannot express the request — a time control it does not offer, or a
 * search already under way — sends the same client command a stale screen
 * on another device would.
 */
export const findChessOpponent = scenarioAction({
  name: 'findChessOpponent',
  act: async (s, actor: string, timeControl: string, keyboard = false) => {
    await Promise.resolve(
      openMultiplayerChess.act(s, actor, undefined, keyboard)
    );
    const ui = await actorUi(s, actor);
    if (await ui.get('multiplayer-access-denial').isVisible()) return;
    const choice = ui.get(
      `multiplayer-time-control-${timeControlKey(timeControl)}`
    );
    if (!(await choice.isVisible())) {
      await Promise.resolve(
        sendMultiplayerCommand.act(s, actor, {
          name: 'findChessOpponent',
          args: { timeControl, requestId: s.session.ports.createId() },
        })
      );
      return;
    }
    forgetMultiplayerReply(s, actor);
    if (keyboard) await choice.key('enter');
    else await choice.tap();
    if (keyboard) await ui.get('multiplayer-find').key('enter');
    else await ui.get('multiplayer-find').tap();
    await s.session.waitForIdle();
  },
});

/** One lightweight control on the person's multiplayer screen (offers, answers). */
export const pressMultiplayerControl = scenarioAction({
  name: 'pressMultiplayerControl',
  act: async (s, actor: string, testId: string, keyboard = false) => {
    await Promise.resolve(
      openMultiplayerChess.act(s, actor, undefined, keyboard)
    );
    const ui = await actorUi(s, actor);
    if (keyboard) await ui.get(testId).key('enter');
    else await ui.get(testId).tap();
    await s.session.waitForIdle();
  },
});

export const confirmMultiplayerCommand = scenarioAction({
  name: 'confirmMultiplayerCommand',
  act: async (
    s,
    actor: string,
    kind: 'stop' | 'resign' | 'abort',
    keyboard = false
  ) => {
    await Promise.resolve(
      openMultiplayerChess.act(s, actor, undefined, keyboard)
    );
    const ui = await actorUi(s, actor);
    const target = ui.get(`multiplayer-${kind}`);
    if (keyboard) await target.key('enter');
    else await target.tap();
    if (kind === 'stop') return;
    if (keyboard) await ui.get('multiplayer-confirm').key('enter');
    else await ui.get('multiplayer-confirm').tap();
    await ui.get('multiplayer-dismiss').expect.visible();
    if (keyboard) await ui.get('multiplayer-dismiss').key('enter');
    else await ui.get('multiplayer-dismiss').tap();
  },
});

export const moveMultiplayerPiece = scenarioAction({
  name: 'moveMultiplayerPiece',
  act: async (s, actor: string, uci: string, keyboard = false) => {
    await Promise.resolve(
      openMultiplayerChess.act(s, actor, undefined, keyboard)
    );
    const ui = await actorUi(s, actor);
    const board = new ChessBoardFlows(ui, 'multiplayer-board');
    if (keyboard) {
      await ui
        .get(
          chessBoardSquareTestId('multiplayer-board', uci.slice(0, 2) as Square)
        )
        .key('enter');
      await ui
        .get(
          chessBoardSquareTestId('multiplayer-board', uci.slice(2, 4) as Square)
        )
        .key('enter');
    } else {
      await board.waitReady();
      await board.drag(uci.slice(0, 2) as Square, uci.slice(2, 4) as Square);
    }
    await s.session.waitForIdle();
  },
});

export const MULTIPLAYER_HARNESS_ACTIONS = [
  refreshMultiplayerConnection,
  setMultiplayerConnection,
  openMultiplayerChess,
  findChessOpponent,
  pressMultiplayerControl,
  confirmMultiplayerCommand,
  moveMultiplayerPiece,
] as const;
