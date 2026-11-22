import { useSpaceScreenChrome } from '@libs/spaces-client-ts/space-screen-chrome';
import { ClaimSpaceShell } from '@libs/spaces-client-ts/space-shell-claim';
import { SpaceInGameTemplate } from '@pkgs/ui-root-client-ts/space-in-game-template';
import type {
  SpaceGameAction,
  SpaceGameInPlay,
  SpaceGameResult,
  SpaceGameSeat,
  SpacePerson,
} from '@pkgs/ui-root-client-ts/space-types';
import { children, createMemo, type JSX } from 'solid-js';

/**
 * Who solves on this board, and so has the turn: the space's host for the
 * shared puzzle feed (everyone else watches, `usePuzzleSpaceRole`), the
 * viewer for their own attempt or draft.
 */
export type PuzzleSolver = 'host' | 'you';

export type PuzzleSpaceInGameProps = {
  /** Stable key of the surface (`data-game`), never a game's id. */
  readonly gameKey: string;
  readonly solver: PuzzleSolver;
  /** The one status line above the board. */
  readonly status: string;
  readonly statusTestId?: string | undefined;
  /** A quiet note beside the status: the clock. */
  readonly detail?: string | undefined;
  /** The stage: the board and what is read with it. */
  readonly board: JSX.Element;
  /** What can be done now, on the action bar (three, then More). */
  readonly actions: readonly SpaceGameAction[];
  /** What the viewer waits for when there is nothing to do. */
  readonly waiting?: string | undefined;
  /** The attempt is over: its outcome and what next, in place of the play's. */
  readonly result?: SpaceGameResult | undefined;
  readonly moreTestId?: string | undefined;
  /**
   * Under row 1: the space's own notice (`SpaceScreenNotice`, given by
   * the screen that wires the room) and the surface's refused changes.
   */
  readonly notice?: JSX.Element;
};

function solves(solver: PuzzleSolver, person: SpacePerson): boolean {
  return solver === 'host' ? person.host === true : person.you === true;
}

/**
 * A puzzle surface played in a space: the space's own rows (its actions
 * and its people, the solver with the turn and everyone else watching),
 * the status line, the board as the stage and the action bar. It claims
 * the space shell, so the space draws no other around it.
 */
export function PuzzleSpaceInGame(props: PuzzleSpaceInGameProps): JSX.Element {
  const chrome = useSpaceScreenChrome();
  // The board is made once: a new status or new actions never remount it.
  const board = children(() => props.board);
  const people = createMemo((): readonly SpacePerson[] =>
    chrome.people.map((person) =>
      solves(props.solver, person) || person.status === 'away'
        ? person
        : { ...person, status: 'watching' }
    )
  );
  const seat = (person: SpacePerson): SpaceGameSeat | undefined =>
    solves(props.solver, person) ? { turn: true } : undefined;
  const game = createMemo(
    (): SpaceGameInPlay => ({
      key: props.gameKey,
      play: {
        status: props.status,
        statusTestId: props.statusTestId,
        detail: props.detail,
        board: board(),
        actions: props.actions,
        waiting: props.waiting,
        seat,
      },
    })
  );
  return (
    <>
      <ClaimSpaceShell />
      <SpaceInGameTemplate
        {...chrome}
        notice={props.notice}
        game={game()}
        role={chrome.role}
        people={people()}
        result={props.result}
        moreTestId={props.moreTestId}
      />
    </>
  );
}
