import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import {
  type GameSeatLook,
  GameSeatSwatch,
} from '@pkgs/ui-root-client-ts/game-seat-swatch';
import { GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import { Grid } from '@pkgs/ui-root-client-ts/grid';
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
            <Show
              when={
                props.ply === props.moves.length &&
                player.winner &&
                props.players.some((p) => !p.winner)
              }
            >
              <Badge size="sm" intent="success" label={<Trans>Winner</Trans>} />
            </Show>
          </StackHorizontal>
        )}
      </For>
    </StackHorizontal>
  );
}

/**
 * Moves shown at once, a page holding the shown move: eight, or under a
 * phone's board six when the game runs longer, so a page and its two range
 * buttons keep to two rows.
 */
const PHONE_PAGE = 6;
const WIDE_PAGE = 8;

/** Beside a wide board, the same page of numbered moves in its own card. */
function ReplayMoves(props: GameReplayScreenViewProps): JSX.Element {
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
        <ReplayMovesPage {...props} />
      </Show>
    </GameSection>
  );
}

/**
 * Under a phone's board: the page of moves holding the shown one, each a
 * whole chip with its number, its seat's swatch and the move ("3 ● 4"),
 * the shown move filled. A header says which moves the page holds and
 * turns the page when the game is longer than one; a page keeps its
 * height, so the board never moves.
 */
function ReplayMovesPage(props: GameReplayScreenViewProps): JSX.Element {
  // The page holding the shown move; the start shows the first page.
  const phone = createMediaQuery(PHONE_QUERY);
  // A short game is one page wherever it is shown.
  const size = () =>
    phone() && props.moves.length > WIDE_PAGE ? PHONE_PAGE : WIDE_PAGE;
  const page = createMemo(() =>
    Math.floor(Math.max(0, props.ply - 1) / size())
  );
  const first = () => page() * size() + 1;
  const last = () => Math.min(first() + size() - 1, props.moves.length);
  const shown = createMemo(() =>
    props.moves
      .slice(first() - 1, last())
      .map((move, index) => ({ move, ply: first() + index }))
  );
  return (
    <Show when={props.moves.length > 0}>
      <StackVertical
        gap="xs"
        align="stretch"
        testId="game-history-review-moves-page"
      >
        <P variant="caption" tone="secondary">
          <Trans>
            Moves {first()}–{last()} of {props.moves.length}
          </Trans>
          <Show when={props.moveHeading !== ''}>
            {': '}
            <Trans>number, player and {props.moveHeading.toLowerCase()}</Trans>
          </Show>
        </P>
        <Grid columns={4} gap="xs" testId="game-history-review-moves">
          <For each={shown()}>
            {(entry) => (
              <Button
                size="sm"
                variant={entry.ply === props.ply ? 'solid' : 'outline'}
                intent={entry.ply === props.ply ? 'primary' : 'neutral'}
                aria-current={entry.ply === props.ply}
                onClick={() => props.onSeek(entry.ply)}
                startIcon={
                  <StackHorizontal align="center" gap="xs">
                    <P variant="caption">{entry.ply}</P>
                    <Show when={entry.move.swatch}>
                      {(look) => (
                        <GameSeatSwatch
                          look={look()}
                          label={entry.move.sideLabel ?? ''}
                        />
                      )}
                    </Show>
                  </StackHorizontal>
                }
                title={entry.move.label}
                dataSet={{
                  testid: `game-history-review-move-${String(entry.ply)}`,
                }}
              />
            )}
          </For>
        </Grid>
        <Show when={page() > 0 || last() < props.moves.length}>
          <StackHorizontal justify="between" align="center" gap="sm">
            <Show when={page() > 0}>
              <Button
                title={
                  <Trans>
                    Moves {first() - size()}–{first() - 1}
                  </Trans>
                }
                size="sm"
                variant="outline"
                intent="neutral"
                icon={ChevronLeftIcon}
                onClick={() => props.onSeek(first() - 1)}
                dataSet={{ testid: 'game-history-review-page-earlier' }}
              />
            </Show>
            <Show when={page() === 0}>
              <StackHorizontal />
            </Show>
            <Show when={last() < props.moves.length}>
              <Button
                title={
                  <Trans>
                    Moves {last() + 1}–
                    {Math.min(last() + size(), props.moves.length)}
                  </Trans>
                }
                size="sm"
                variant="outline"
                intent="neutral"
                endIcon={<ChevronRightIcon size={16} />}
                onClick={() => props.onSeek(last() + 1)}
                dataSet={{ testid: 'game-history-review-page-later' }}
              />
            </Show>
          </StackHorizontal>
        </Show>
      </StackVertical>
    </Show>
  );
}

/** How the game ended, said to the viewer, and when: "You won by four in a row. · 2d ago". */
function ReplaySubtitle(props: GameReplayScreenViewProps): JSX.Element {
  const ago = useRelativeTimeLabel(() => props.endedAt ?? '');
  return (
    <>
      <Show when={props.outcome === null}>
        <Trans>Watched</Trans> ·{' '}
      </Show>
      {/* The result waits for the final position, as the Winner badge does,
          so stepping through never gives the ending away. */}
      <Show
        when={props.ply === props.moves.length}
        fallback={<Trans>Replaying the game</Trans>}
      >
        {props.result}
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
    >
      <GameSessionLayout
        actionsBeside
        fixedStage
        status={<ReplaySteps {...props} />}
        aside={
          <Show when={!phone()}>
            <ReplayMoves {...props} />
          </Show>
        }
      >
        <GameBoardStage
          others={<ReplayPlayers {...props} place="over" />}
          own={
            <StackVertical gap="sm" align="stretch">
              <ReplayPlayers {...props} place="under" />
              <Show when={phone()}>
                <ReplayMovesPage {...props} />
              </Show>
            </StackVertical>
          }
        >
          {props.board}
        </GameBoardStage>
      </GameSessionLayout>
    </GameScreen>
  );
}
