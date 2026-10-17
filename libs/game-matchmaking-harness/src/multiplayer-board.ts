import {
  actorUi,
  ensureActor,
  pollUntil,
  scenarioAction,
} from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';
import { joinViaLink } from '@libs/spaces-harness/space-actions';
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
    await ensureActor(s, watcher);
    const spaceId = await multiplayerSpaceId(s, host);
    if (spaceId === null) throw new Error('The multiplayer host has no space');
    await Promise.resolve(joinViaLink.act(s, watcher, `/space/${spaceId}`));
    const hostBoard = await multiplayerBoardShown(s, host);
    await pollUntil(
      s,
      async () =>
        (await multiplayerBoardShown(s, watcher)).gameId === hostBoard.gameId
          ? true
          : null,
      { maxMs: 5000, description: 'the shared multiplayer board' }
    );
  },
});
