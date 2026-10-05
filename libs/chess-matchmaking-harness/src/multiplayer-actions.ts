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
import { multiplayerView } from './multiplayer-reads';

/** Ask the ordinary query transport to observe the changed network. */
export const refreshMultiplayerConnection = scenarioAction({
  name: 'refreshMultiplayerConnection',
  act: async (s, actor: string) => {
    const { engine } = await multiplayerClient(s, actor);
    void engine.refreshQueries();
    await s.session.waitForIdle();
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
      void env.createAuthClient().session.refresh();
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
    for (
      let pops = 0;
      pops < 4 && !(await ui.get('tab-chess').isVisible());
      pops++
    ) {
      const back = (await ui.get('space-close').isVisible())
        ? 'space-close'
        : 'nav-back';
      if (keyboard) await ui.get(back).key('enter');
      else await ui.get(back).tap();
      await s.session.waitForIdle();
    }
    if (gameId === undefined) {
      if (keyboard) await ui.get('tab-chess').key('enter');
      else await ui.get('tab-chess').tap();
    } else
      await s.actors
        .get(actor)!
        .openLink(`/chess/multiplayer/${encodeURIComponent(gameId)}`);
    await s.session.waitForIdle();
    await pollUntil(
      s,
      async () => {
        if (await ui.get('multiplayer-access-denial').isVisible()) return true;
        const view = await multiplayerView(s, actor);
        const target =
          gameId !== undefined
            ? view.game?.id === gameId
              ? 'multiplayer-game'
              : 'multiplayer-unavailable'
            : view.game !== null
              ? 'multiplayer-game'
              : view.search?.standing === 'waiting'
                ? 'multiplayer-waiting'
                : 'multiplayer-find';
        return (await ui.get(target).isVisible()) ? true : null;
      },
      { maxMs: 5000, description: 'the owned multiplayer screen' }
    );
  },
});

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
