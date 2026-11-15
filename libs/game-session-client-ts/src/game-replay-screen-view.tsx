import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import {
  GameMoveList,
  type GameMoveListEntry,
} from '@pkgs/ui-root-client-ts/game-move-list';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import {
  type GameSeatLook,
  GameSeatSwatch,
} from '@pkgs/ui-root-client-ts/game-seat-swatch';
import { GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import { IconButton } from '@pkgs/ui-root-client-ts/icon-button';
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { KeyHints } from '@pkgs/ui-root-client-ts/key-hints';
import { createMediaQuery } from '@pkgs/ui-root-client-ts/media-query';
import { useRelativeTimeLabel } from '@pkgs/ui-root-client-ts/relative-time';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { useDocumentShortcuts } from '@pkgs/ui-root-client-ts/use-document-shortcuts';
import { useHoverCapable } from '@pkgs/ui-root-client-ts/use-hover-capable';
import { createMemo, For, type JSX, Show } from 'solid-js';
import type { FramePeople } from './game-frame-view-types';
import {
  type GameHistoryOutcome,
  type GameHistoryPlayer,
  HistoryPlayers,
} from './game-history-screen-view';

/** One player of the replayed game, with the seat they played. */
export type GameReplayPlayer = GameHistoryPlayer & {
  /** The seat's name in the game ("Red circle"). */
  readonly sideLabel: string;
  readonly swatch?: GameSeatLook | undefined;
  /** The result went to this player's seat. */
  readonly winner: boolean;
  /** The viewer. */
  readonly you: boolean;
};

/** One played move, as the game writes it, and the seat that made it. */
export type GameReplayMove = {
  readonly label: string;
  readonly sideLabel?: string | undefined;
  readonly swatch?: GameSeatLook | undefined;
};

export type GameReplayScreenViewProps = {
  /** Everyone who played, in seat order. */
  readonly players: readonly GameReplayPlayer[];
  /** The viewer's result; `null` when they did not play. */
  readonly outcome: GameHistoryOutcome | null;
  /** How the game ended, in words, said to the viewer ("You won by four in a row."). */
  readonly result: string;
  /** When it ended, as an ISO instant; `null` when unknown. */
  readonly endedAt: string | null;
  /** The position shown: 0 is the start, `moves.length` the end. */
  readonly ply: number;
  readonly moves: readonly GameReplayMove[];
  /** The word that names bare-number moves once (`Column`); `''` for none. */
  readonly moveHeading: string;
  /** The position shown, for automated observers. */
  readonly position: string;
  /** The game's own board, read-only, at `position`. */
  readonly board: JSX.Element;
  readonly people?: FramePeople | undefined;
  /** Show the position after `ply` moves. */
  readonly onSeek: (ply: number) => void;
  /** Back to the list of finished games. */
  readonly onBack: () => void;
};

/** Where `GameSessionLayout`'s `fixedStage` lays the moves out as one line. */
const PHONE_QUERY = '(max-width: 767px)';

/** A step through the moves is a full touch target. */
const STEP_SIZE = 44;
const STEP_PLATE = 'surfaceMuted';

/** Which position the board shows, in words; never the game's result. */
function ShownPosition(props: GameReplayScreenViewProps): JSX.Element {
  const last = () => props.moves.length;
  return (
    <StackVertical
      align="center"
      role="status"
      testId="game-history-review-move"
      dataSet={{ 'shown-position': props.position, ply: String(props.ply) }}
    >
      <P variant="label">
        <Show when={last() > 0} fallback={<Trans>No moves were played</Trans>}>
          <Show when={props.ply > 0} fallback={<Trans>Start</Trans>}>
            <Trans>
              Move {props.ply} of {last()}
            </Trans>
          </Show>
        </Show>
      </P>
      {/* Always a second line, so the bar, and the board over it, keep one
          height from the start to the end. */}
      <Show when={last() > 0}>
        <Show
          when={props.ply > 0 && props.ply < last()}
          fallback={
            <P variant="caption" tone="secondary">
              <Show when={props.ply > 0} fallback={<Trans>No moves yet</Trans>}>
                <Trans>Final position</Trans>
              </Show>
            </P>
          }
        >
          <ShownMove {...props} />
        </Show>
      </Show>
    </StackVertical>
  );
}

/**
 * The move that reached the shown position: its seat's swatch (named for a
 * listener) and the move in words ("● Column 4"), short enough for one line.
 */
function ShownMove(props: GameReplayScreenViewProps): JSX.Element {
  const move = () => props.moves[props.ply - 1];
  return (
    <StackHorizontal align="center" gap="xs">
      <Show when={move()?.swatch}>
        {(look) => (
          <GameSeatSwatch look={look()} label={move()?.sideLabel ?? ''} />
        )}
      </Show>
      <P variant="caption" tone="secondary">
        <Show when={props.moveHeading !== ''}>{props.moveHeading} </Show>
        {move()?.label}
      </P>
    </StackHorizontal>
  );
}

/** The four steps through the moves, and the arrow keys that take them. */
function ReplaySteps(props: GameReplayScreenViewProps): JSX.Element {
  const last = () => props.moves.length;
  const seek = (ply: number): boolean => {
    const next = Math.min(last(), Math.max(0, ply));
    if (next === props.ply) return false;
    props.onSeek(next);
    return true;
  };
  useDocumentShortcuts({
    enabled: () => last() > 0,
    onKeyDown: (event) => {
      if (event.key === 'ArrowLeft') return seek(props.ply - 1);
      if (event.key === 'ArrowRight') return seek(props.ply + 1);
      if (event.key === 'Home') return seek(0);
      if (event.key === 'End') return seek(last());
      return undefined;
    },
  });
  const keyboard = useHoverCapable();
  return (
    <Show when={last() > 0} fallback={<ShownPosition {...props} />}>
      <StackVertical gap="xs" align="stretch">
        <StackHorizontal
          gap="sm"
          align="center"
          justify="between"
          testId="game-history-review-steps"
        >
          <StackHorizontal gap="sm" align="center">
            <IconButton
              label={t`Go to the start`}
              size={STEP_SIZE}
              background={STEP_PLATE}
              disabled={props.ply === 0}
              onClick={() => seek(0)}
              dataSet={{ testid: 'game-history-review-first' }}
            >
              <ChevronsLeftIcon />
            </IconButton>

            <IconButton
              label={t`Previous move`}
              size={STEP_SIZE}
              background={STEP_PLATE}
              disabled={props.ply === 0}
              onClick={() => seek(props.ply - 1)}
              dataSet={{ testid: 'game-history-review-back' }}
            >
              <ChevronLeftIcon />
            </IconButton>
          </StackHorizontal>
          <StackVertical grow align="center">
            <ShownPosition {...props} />
          </StackVertical>
          <StackHorizontal gap="sm" align="center">
            <IconButton
              label={t`Next move`}
              size={STEP_SIZE}
              background={STEP_PLATE}
              disabled={props.ply === last()}
              onClick={() => seek(props.ply + 1)}
              dataSet={{ testid: 'game-history-review-forward' }}
            >
              <ChevronRightIcon />
            </IconButton>

            <IconButton
              label={t`Go to the final position`}
              size={STEP_SIZE}
              background={STEP_PLATE}
              disabled={props.ply === last()}
              onClick={() => seek(last())}
              dataSet={{ testid: 'game-history-review-last' }}
            >
              <ChevronsRightIcon />
            </IconButton>
          </StackHorizontal>
        </StackHorizontal>
        <Show when={keyboard()}>
          <KeyHints
            hints={[
              { keys: ['←', '→'], label: t`step` },
              { keys: ['Home', 'End'], label: t`start or end` },
            ]}
          />
        </Show>
      </StackVertical>
    </Show>
  );
}

/**
 * Players beside their seat's colour, the winner marked in words: as at the
 * table, the others over the board and the viewer under it (a watched
 * game: the first seat over, the rest under).
 */
function ReplayPlayers(
  props: GameReplayScreenViewProps & {
    readonly place: 'over' | 'under';
  }
): JSX.Element {
  const shown = createMemo(() => {
    const viewer = props.players.some((player) => player.you);
    return props.players.filter((player, index) =>
      viewer
        ? player.you === (props.place === 'under')
        : (index === 0) === (props.place === 'over')
    );
  });
  return (
    <StackHorizontal
      align="center"
      gap="md"
      wrap
      testId={`game-history-review-players-${props.place}`}
    >
      <For each={shown()}>
        {(player) => (
          <StackHorizontal align="center" gap="xs">
            <Show when={player.swatch}>
              {(look) => (
                <GameSeatSwatch look={look()} label={player.sideLabel} />
              )}
            </Show>
            <P variant="label">
              <HistoryPlayers
                players={[player]}
                played={false}
                people={props.people}
              />
              <Show when={player.you}>
                {' '}
                <Trans>(you)</Trans>
              </Show>
            </P>
            <Show when={player.winner && props.players.some((p) => !p.winner)}>
              <Badge size="sm" intent="success" label={<Trans>Winner</Trans>} />
            </Show>
          </StackHorizontal>
        )}
      </For>
    </StackHorizontal>
  );
}

/** Each move for a `GameMoveList`, named for a listener ("Move 3, Red circle: 4"). */
function moveEntries(
  moves: readonly GameReplayMove[]
): readonly GameMoveListEntry[] {
  return moves.map((move, index) => ({
    ply: index + 1,
    label: move.label,
    swatch: move.swatch,
    accessibleName:
      move.sideLabel === undefined
        ? t`Move ${index + 1}: ${move.label}`
        : t`Move ${index + 1}, ${move.sideLabel}: ${move.label}`,
    testId: `game-history-review-move-${String(index + 1)}`,
  }));
}

/** Moves a phone shows at once under the board: a page holding the shown move. */
const PHONE_PAGE = 8;

/**
 * Every move, numbered one by one as the position is ("Move 3 of 7"),
 * beside a wide board; pressing one shows the board after it.
 */
function ReplayMoves(props: GameReplayScreenViewProps): JSX.Element {
  const entries = createMemo(() => moveEntries(props.moves));
  return (
    <GameSection title={<Trans>Moves</Trans>}>
      <Show
        when={props.moves.length > 0}
        fallback={
          <P variant="caption" tone="secondary">
            <Trans>The game ended before anyone moved.</Trans>
          </P>
        }
      >
        <GameMoveList
          layout="table"
          aria-label={t`Moves played`}
          perTurn={1}
          current={props.ply}
          moves={entries()}
          onSelect={props.onSeek}
          heading={props.moveHeading || undefined}
          ended
        />
      </Show>
    </GameSection>
  );
}

/**
 * Under a phone's board: the page of moves holding the shown one ("Moves
 * 1–8 · Column ●4 ◆3 …"), every move whole and wrapping onto a second line
 * rather than cut at an edge, the shown move marked. The steps turn the
 * page; a page keeps its height, so the board never moves.
 */
function ReplayMovesPage(props: GameReplayScreenViewProps): JSX.Element {
  const entries = createMemo(() => moveEntries(props.moves));
  const last = (page: number): number =>
    Math.min(page * PHONE_PAGE, props.moves.length);
  return (
    <Show when={props.moves.length > 0}>
      <GameMoveList
        layout="turn"
        aria-label={t`Moves played`}
        perTurn={PHONE_PAGE}
        current={props.ply}
        moves={entries()}
        onSelect={props.onSeek}
        heading={props.moveHeading || undefined}
        turnLabel={(page) => (
          <Trans>
            Moves {(page - 1) * PHONE_PAGE + 1}–{last(page)} of{' '}
            {props.moves.length}
          </Trans>
        )}
        wrap
        ended
        dataSet={{ testid: 'game-history-review-moves-page' }}
      />
    </Show>
  );
}

/** How the game ended, said to the viewer, and when: "You won by four in a row. · 2d ago". */
function ReplaySubtitle(props: GameReplayScreenViewProps): JSX.Element {
  const ago = useRelativeTimeLabel(() => props.endedAt ?? '');
  return (
    <>
      <Show when={props.outcome === null} fallback={<Trans>Your game</Trans>}>
        <Trans>Watched</Trans>
      </Show>
      <Show when={props.endedAt !== null}> · {ago()}</Show>
    </>
  );
}

/**
 * Replaying one finished game from History and stats, presentational: who
 * played and how it ended above the game's own board (`board`), the
 * position shown in words under it, the four steps (and the arrow keys),
 * and every move to jump to.
 */
export function GameReplayScreenView(
  props: GameReplayScreenViewProps
): JSX.Element {
  // A phone's one fixed view (`fixedStage`) pages its moves under the
  // board; a wide screen lists them all in the rail beside it.
  const phone = createMediaQuery(PHONE_QUERY);
  const opponents = createMemo(() =>
    props.outcome === null
      ? props.players
      : props.players.filter((player) => !player.you)
  );
  return (
    <GameScreen
      screenId="game-history-review"
      title={
        <HistoryPlayers
          players={opponents()}
          played={props.outcome !== null}
          people={props.people}
        />
      }
      subtitle={<ReplaySubtitle {...props} />}
    >
      <GameSessionLayout
        actionsBeside
        fixedStage
        status={<ReplaySteps {...props} />}
        actions={
          <Button
            title={<Trans>All games</Trans>}
            variant="outline"
            intent="neutral"
            icon={ArrowLeftIcon}
            onClick={() => props.onBack()}
            dataSet={{ testid: 'game-history-review-back-to-list' }}
          />
        }
        aside={
          <Show when={!phone()}>
            <ReplayMoves {...props} />
          </Show>
        }
      >
        <GameBoardStage
          others={<ReplayPlayers {...props} place="over" />}
          turn={
            <Show when={phone()}>
              <ReplayMovesPage {...props} />
            </Show>
          }
          own={<ReplayPlayers {...props} place="under" />}
        >
          {props.board}
        </GameBoardStage>
      </GameSessionLayout>
    </GameScreen>
  );
}
