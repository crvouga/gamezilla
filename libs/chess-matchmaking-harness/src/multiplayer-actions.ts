import { timeControlKey } from '@libs/chess-matchmaking-shared/time-control';
import { partition, restoreActorConnection } from '@libs/harness/actions';
import {
  actorUi,
  ensureActor,
  pollUntil,
  scenarioAction,
} from '@libs/harness/actor-ui';
import { ChessBoardFlows } from '@pkgs/chess-board-core-shared/flows';
import { chessBoardSquareTestId } from '@pkgs/chess-board-core-shared/probe';
import type { Square } from '@pkgs/chess-board-core-shared/types';
import { multiplayerClient } from './multiplayer-client';
import {
  forgetMultiplayerReply,
  sendMultiplayerCommand,
} from './multiplayer-commands';
import {
  multiplayerArrivalIsTerminal,
  reachMultiplayerChoices,
} from './multiplayer-navigation';
import { multiplayerView } from './multiplayer-reads';
import { multiplayerSpaceId } from './multiplayer-spaces';
import { multiplayerWatcherBoard } from './multiplayer-watchers';

/** Ask the ordinary query transport to observe the changed network. */
export const refreshMultiplayerConnection = scenarioAction({
  name: 'refreshMultiplayerConnection',
  act: async (s, actor: string) => {
    const { engine } = await multiplayerClient(s, actor);
    let drained = false;
    void engine.refreshQueries().then(() => {
      drained = true;
    });
    await pollUntil(s, async () => (drained ? true : null), {
      maxMs: 5000,
      stepMs: 1,
      description: 'multiplayer connection refresh',
    });
  },
});

/** Change one device's real HTTP and push reachability; leave its peers alone. */
export const setMultiplayerConnection = scenarioAction({
  name: 'setMultiplayerConnection',
  act: async (s, actor: string, online: boolean) => {
    const change = online
      ? s.session.network.heal.bind(s.session.network)
      : s.session.network.partition.bind(s.session.network);
    change(s.harness.loadBalancer.id, actor);
    if (online) {
      await Promise.resolve(restoreActorConnection.act(s, `${actor}:events`));
      await Promise.resolve(restoreActorConnection.act(s, actor));
      const { env } = await multiplayerClient(s, actor);
      let refreshed = false;
      void env
        .createAuthClient(env.server)
        .session.refresh()
        .finally(() => {
          refreshed = true;
        });
      await pollUntil(s, async () => (refreshed ? true : null), {
        maxMs: 5000,
        stepMs: 1,
        description: 'multiplayer returning session',
      });
    } else {
      await Promise.resolve(partition.act(s, actor));
      await Promise.resolve(partition.act(s, `${actor}:events`));
    }
    await Promise.resolve(refreshMultiplayerConnection.act(s, actor));
  },
});

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
      await ui.get('chess-menu-multiplayer').expect.visible();
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
