import {
  actorUi,
  ensureActor,
  pollUntil,
  scenarioAction,
} from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront } from '@libs/harness-ts/observations';
import { joinSpaceFromLink } from '@libs/spaces-harness-ts/space-link';
import {
  forgetMultiplayerReply,
  sendMultiplayerCommand,
} from './multiplayer-commands';
import { multiplayerView } from './multiplayer-reads';
import { multiplayerSpaceId } from './multiplayer-spaces';

/** A matched game's board as a device's screen shows it, whichever game it is. */
export type MultiplayerBoardShown = {
  /** The matched game on the screen; null when there is none. */
  readonly gameId: string | null;
  /** Its position, in the game's own notation. */
  readonly fen: string | null;
  /** How many accepted moves it shows; -1 without a board. */
  readonly revision: number;
  /** `ongoing`, `white`, `black`, `draw` or `aborted`. */
  readonly outcome: string | null;
  /** The person may make a move in it now. */
  readonly canMove: boolean;
  /** The board in front of them takes a move: not while it shows an earlier position. */
  readonly boardTakesMoves: boolean;
};

/** Read the board a device shows and whether its person may move on it. */
export async function multiplayerBoardShown(
  s: ProductHarness,
  actor: string
): Promise<MultiplayerBoardShown> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  const html = await ui.snapshotHtml();
  const tag = html?.match(/<[^>]*data-testid="multiplayer-game"[^>]*>/)?.[0];
  const attribute = (name: string) =>
    tag?.match(new RegExp(`${name}="([^"]+)"`))?.[1] ?? null;
  return {
    gameId: attribute('data-game-id'),
    fen: attribute('data-fen'),
    revision: Number(attribute('data-revision') ?? -1),
    outcome: attribute('data-outcome'),
    canMove: attribute('data-can-move') === 'true',
    boardTakesMoves: attribute('data-board-takes-moves') === 'true',
  };
}

/** `watcher` joins `host`'s space and is shown the host's matched game there. */
export const joinMultiplayerSpace = scenarioAction({
  name: 'joinMultiplayerSpace',
  act: async (s, watcher: string, host: string) => {
    const spaceId = await multiplayerSpaceId(s, host);
    if (spaceId === null) throw new Error('The multiplayer host has no space');
    const { opened, afterJoin } = await joinSpaceFromLink(
      s,
      watcher,
      `/space/${spaceId}`,
      'enter'
    );
    const arrival =
      afterJoin === undefined ? opened : `${opened} → ${afterJoin}`;
    // The host can still be loading the board when the guest joins. A search
    // can also have no match yet. The host's synced record distinguishes them.
    const gameId = (await multiplayerView(s, host)).game?.id ?? null;
    for (const actor of [host, watcher]) {
      const ui = await actorUi(s, actor);
      await bringToFront(s, actor);
      const board = ui.get('multiplayer-game');
      await pollUntil(
        s,
        async () => {
          const shown = (await board.isVisible())
            ? await board.attribute('data-game-id')
            : null;
          return shown === gameId ? true : null;
        },
        {
          maxMs: 5000,
          description: `${actor} sees the shared multiplayer board ${gameId ?? 'after pairing'} (${watcher}: ${arrival})`,
          actor,
        }
      );
    }
  },
});

/** A move a person makes on their matched game's board, at the revision it shows. */
export type MatchedGameMove = {
  readonly gameId: string;
  readonly revision: number;
  /** The game's own action. */
  readonly uci: string;
  /** The screen's request id: a repeated one is answered as before. */
  readonly requestId: string;
};

/**
 * The person plays a move on the board their device shows. The board sends
 * it as the screen does (`'sent'`); a board that shows an earlier position
 * sends nothing (`'reviewing'`), and the game's own board gesture is all the
 * person's hand can try on it.
 */
export async function sendMoveFromBoard(
  s: ProductHarness,
  actor: string,
  move: MatchedGameMove
): Promise<'sent' | 'reviewing'> {
  await ensureActor(s, actor);
  if (
    await (await actorUi(s, actor)).get('multiplayer-reviewing').isVisible()
  ) {
    forgetMultiplayerReply(s, actor);
    return 'reviewing';
  }
  await Promise.resolve(
    sendMultiplayerCommand.act(s, actor, {
      name: 'playMultiplayerMove',
      args: { ...move },
    })
  );
  return 'sent';
}
