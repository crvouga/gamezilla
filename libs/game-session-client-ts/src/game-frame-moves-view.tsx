import { t } from '@lingui/core/macro';
import { Plural, Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import {
  GameMoveList,
  type GameMoveListEntry,
} from '@pkgs/ui-root-client-ts/game-move-list';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { GameSeatSwatch } from '@pkgs/ui-root-client-ts/game-seat-swatch';
import { GameActions, GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import { GameTurnPill } from '@pkgs/ui-root-client-ts/game-turn-pill';
import { IconButton } from '@pkgs/ui-root-client-ts/icon-button';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { Select } from '@pkgs/ui-root-client-ts/select';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import type { JSX } from '@solidjs/web';
import { createMemo, createSignal, For, Show } from 'solid-js';
import type { FramePlaceProps } from './custom-game-screen-view';
import { FrameNoticesView } from './game-frame-shell';
import { FrameErrorView, FrameStatusView } from './game-frame-status-view';
import type { FrameRecord } from './game-frame-view-types';

/** Moving through the record: to a numbered position, back to the live one, or another game. */
export type FrameReviewHandlers = {
  readonly onSeek: (ply: number) => void;
  readonly onReturnLive: () => void;
  readonly onSelectRecord: (selection: string) => void;
  readonly onOpenHistory: () => void;
};

type Props = FramePlaceProps;

type RecordProps = Props & { readonly record: FrameRecord };

/** A step through the moves is a full touch target. */
const STEP_SIZE = 44;
const STEP_PLATE = 'border';

/** How many of the latest moves the list holds; earlier ones are reached by number. */
const LISTED_MOVES = 40;

/** The first listed ply's index: a long game lists only its latest moves. */
function firstListed(record: FrameRecord): number {
  return Math.max(0, record.moves.length - LISTED_MOVES);
}

/** The record shows an earlier position, or an earlier game, not the live one. */
export function recordReviewing(record: FrameRecord | null): boolean {
  return (
    record !== null &&
    (record.selection !== 'live' || record.displayedPly < record.moves.length)
  );
}

/** The game is played by turns and has moves to step through. */
export function recordPlayed(record: FrameRecord | null): boolean {
  return record !== null && record.turns && record.moves.length > 0;
}

/** How many earlier moves the list leaves out; each is reached by its number. */
function EarlierMoves(props: { readonly count: number }): JSX.Element {
  return (
    <Show when={props.count > 0}>
      <P
        variant="caption"
        tone="secondary"
        dataSet={{ testid: 'custom-game-earlier-moves' }}
      >
        <Plural
          value={props.count}
          one="# earlier move"
          other="# earlier moves"
        />
      </P>
    </Show>
  );
}

/**
 * The latest moves, every move on its own row numbered 1 to N (the one
 * count the move shown, "Move 3 of 8", and the move-number field share),
 * each behind its mover's swatch (the game's word for bare-number moves,
 * `Column`, said once). Pressing a move shows the board after it.
 */
function RecordMoves(
  props: RecordProps & { readonly onSelect: (ply: number) => void }
): JSX.Element {
  const first = createMemo(() => firstListed(props.record));
  const moves = createMemo((): readonly GameMoveListEntry[] =>
    props.record.moves.slice(first()).map((label, index) => {
      const ply = first() + index + 1;
      const mover = props.record.movers[ply - 1];
      return {
        ply,
        label,
        swatch: mover?.swatch,
        accessibleName:
          mover === undefined
            ? t`Move ${ply}: ${label}`
            : t`Move ${ply}, ${mover.sideLabel}: ${label}`,
        testId: `custom-game-review-move-${ply}`,
      };
    })
  );
  return (
    <GameMoveList
      layout="table"
      aria-label={t`Moves played`}
      perTurn={1}
      current={props.record.displayedPly}
      moves={moves()}
      onSelect={props.onSelect}
      leading={<EarlierMoves count={first()} />}
      heading={props.record.moveHeading || undefined}
      turnLabel={(turn) => <Trans>Move {turn}</Trans>}
      wrap
      ended={props.phase === 'completed' || props.phase === 'cancelled'}
    />
  );
}

/**
 * Before the first move, what the game has ahead, one row per step (`Deal 1
 * · Pass left`), the step open now marked `Now` in words, not by colour
 * alone.
 */
function RecordOutline(props: { readonly record: FrameRecord }): JSX.Element {
  return (
    <StackVertical gap="xs" testId="custom-game-record-outline">
      <For each={props.record.outline ?? []}>
        {(step) => (
          <StackHorizontal align="center" justify="between" gap="sm">
            <StackHorizontal align="center" gap="sm">
              <P variant="caption" tone="secondary">
                {step.label}
              </P>
              <P variant={step.current ? 'label' : 'body'}>{step.detail}</P>
            </StackHorizontal>
            <Show when={step.current}>
              <Badge label={<Trans>Now</Trans>} intent="brand" size="sm" />
            </Show>
          </StackHorizontal>
        )}
      </For>
    </StackVertical>
  );
}

/**
 * The moves played so far, beside the live board (under it on a phone): a
 * list to read, never to steer the live board with. Pressing a move, or
 * Review moves, opens the moves place at it.
 */
export function FrameMovesCard(
  props: Props & {
    /** The place has its own way to the moves place (the result's Review moves). */
    readonly listOnly?: boolean | undefined;
  }
): JSX.Element {
  const review = (ply: number): void => {
    props.onSeek(ply);
    props.onOpen({ screen: 'moves' });
  };
  return (
    <Show when={props.record?.turns === true ? props.record : null}>
      {(record) => (
        <GameSection
          title={<Trans>Moves</Trans>}
          dataSet={{
            component: 'CustomGameReview',
            testid: 'custom-game-record',
          }}
          footer={
            <Show when={recordPlayed(record()) && props.listOnly !== true}>
              <GameActions>
                <Button
                  title={<Trans>Review moves</Trans>}
                  variant="outline"
                  intent="neutral"
                  size="sm"
                  onClick={() => review(record().displayedPly)}
                  dataSet={{ testid: 'custom-game-review-jump' }}
                />
              </GameActions>
            </Show>
          }
        >
          <Show
            when={recordPlayed(record())}
            fallback={
              <Show
                when={(record().outline?.length ?? 0) > 0}
                fallback={
                  <P variant="caption" tone="secondary">
                    <Trans>No moves yet.</Trans>
                  </P>
                }
              >
                <RecordOutline record={record()} />
              </Show>
            }
          >
            <RecordMoves {...props} record={record()} onSelect={review} />
          </Show>
        </GameSection>
      )}
    </Show>
  );
}

/** The four steps through the moves: the start, back, forward, the end. */
function RecordSteps(props: RecordProps): JSX.Element {
  const shown = () => props.record.displayedPly;
  const last = () => props.record.moves.length;
  return (
    <StackHorizontal
      gap="sm"
      align="center"
      justify="center"
      testId="custom-game-record-steps"
    >
      <IconButton
        label={t`Go to the start`}
        size={STEP_SIZE}
        background={STEP_PLATE}
        disabled={shown() === 0}
        onClick={() => props.onSeek(0)}
        dataSet={{ testid: 'custom-game-review-first' }}
      >
        <ChevronsLeftIcon />
      </IconButton>
      <IconButton
        label={t`Previous move`}
        size={STEP_SIZE}
        background={STEP_PLATE}
        disabled={shown() === 0}
        onClick={() => props.onSeek(shown() - 1)}
        dataSet={{ testid: 'custom-game-review-back' }}
      >
        <ChevronLeftIcon />
      </IconButton>
      <IconButton
        label={t`Next move`}
        size={STEP_SIZE}
        background={STEP_PLATE}
        disabled={shown() >= last()}
        onClick={() => props.onSeek(shown() + 1)}
        dataSet={{ testid: 'custom-game-review-forward' }}
      >
        <ChevronRightIcon />
      </IconButton>
      <IconButton
        label={t`Go to the latest move`}
        size={STEP_SIZE}
        background={STEP_PLATE}
        disabled={!recordReviewing(props.record)}
        onClick={() => props.onReturnLive()}
        dataSet={{ testid: 'custom-game-review-live' }}
      >
        <ChevronsRightIcon />
      </IconButton>
    </StackHorizontal>
  );
}

/** A move by its number: for a long game, and for a listener. */
function ReviewJumpField(props: RecordProps): JSX.Element {
  const [jump, setJump] = createSignal(String(props.record.displayedPly));
  return (
    <StackHorizontal align="end" gap="sm">
      <StackVertical grow>
        <TextInput
          type="number"
          label={<Trans>Go to move number</Trans>}
          value={jump()}
          onChangeText={setJump}
          dataSet={{ testid: 'custom-game-review-ply' }}
        />
      </StackVertical>
      <Button
        title={<Trans>Go</Trans>}
        variant="outline"
        intent="neutral"
        onClick={() => props.onSeek(Number(jump()))}
        dataSet={{ testid: 'custom-game-review-seek' }}
      />
    </StackHorizontal>
  );
}

/** Another game of this space, chosen by the record. */
function RecordSelect(props: RecordProps): JSX.Element {
  const options = createMemo(() => [
    { value: 'live', label: <Trans>Current game</Trans> },
    ...props.record.earlier.map((id, index) => ({
      value: id,
      label: <Trans>Earlier game {index + 1}</Trans>,
    })),
  ]);
  return (
    <Show when={props.record.earlier.length > 0}>
      <Select
        label={<Trans>Game</Trans>}
        options={options()}
        value={props.record.selection}
        onValueChange={(value) => props.onSelectRecord(String(value))}
        dataSet={{ testid: 'custom-game-history' }}
      />
    </Show>
  );
}

/**
 * Who made the shown move, when a turn holds more than one move (so its
 * number alone does not say); else `null`.
 */
function turnOf(record: FrameRecord): { readonly side: string } | null {
  const mover = record.movers[record.displayedPly - 1];
  if (record.perTurn <= 1 || mover === undefined) return null;
  return { side: mover.sideLabel };
}

/** Which position the board shows, in words. */
function ReviewingLine(props: { readonly record: FrameRecord }): JSX.Element {
  return (
    <GameTurnPill
      live
      tone={recordReviewing(props.record) ? 'warning' : 'neutral'}
      // The move shown is marked by its mover's piece, not a warning dot.
      mark={
        <Show when={props.record.movers[props.record.displayedPly - 1]?.swatch}>
          {(look) => <GameSeatSwatch look={look()} />}
        </Show>
      }
      dataSet={{ testid: 'custom-game-reviewing' }}
      title={
        <Show
          when={props.record.displayedPly > 0}
          fallback={<Trans>The starting position</Trans>}
        >
          <Show
            when={props.record.selection === 'live'}
            fallback={
              <Trans>
                An earlier game, after move {props.record.displayedPly}
              </Trans>
            }
          >
            <Show
              when={turnOf(props.record)}
              fallback={
                <Trans>
                  After move {props.record.displayedPly} of{' '}
                  {props.record.moves.length}
                </Trans>
              }
            >
              {(turn) => (
                // Counted as a move number is asked for: every move, then
                // whose it was.
                <Trans>
                  Move {props.record.displayedPly} of{' '}
                  {props.record.moves.length}, {turn().side}
                </Trans>
              )}
            </Show>
          </Show>
        </Show>
      }
    />
  );
}

/** Every move, the game chosen and a move by its number, in one section. */
function EveryMove(props: RecordProps): JSX.Element {
  return (
    <GameSection
      title={<Trans>Every move</Trans>}
      dataSet={{
        component: 'CustomGameReview',
        testid: 'custom-game-record',
      }}
    >
      <RecordSelect {...props} />
      <Show when={recordPlayed(props.record)}>
        <RecordMoves {...props} onSelect={props.onSeek} />
      </Show>
      <ReviewJumpField {...props} />
    </GameSection>
  );
}

/**
 * The moves place: the board at one position of the record, the four
 * steps under it, and every move beside it. It never plays: leaving it
 * returns the board to the game as it stands.
 */
export function FrameMovesPlace(props: RecordProps): JSX.Element {
  const over = (): boolean =>
    props.phase === 'completed' || props.phase === 'cancelled';
  const mode = useLayoutMode();
  const wide = (): boolean => mode() === 'wide';
  return (
    <GameScreen
      screenId="custom-game-stage-moves"
      title={<Trans>Moves</Trans>}
      compactInset={props.table.compactInset}
    >
      <GameSessionLayout
        dataSet={{
          component: 'CustomGameContent',
          testid: 'custom-game-content',
          phase: props.phase,
          place: props.place.screen,
        }}
        notices={
          <FrameNoticesView connection={props.connection} error={props.error} />
        }
        // A phone is one fixed view, as play is: every move the line over
        // the board, the steps, the game chosen and a move by its number
        // under it, and the way back pinned at the foot. A wide screen lists
        // every move beside the board.
        boardFocus
        actionsBeside
        fixedStage={props.boardWorkspace !== true}
        status={
          <>
            <RecordSteps {...props} />
            <Show when={!wide()}>
              <RecordSelect {...props} />
              <ReviewJumpField {...props} />
            </Show>
            <FrameErrorView text={props.record.error} />
          </>
        }
        actions={
          <Button
            title={
              <Show when={over()} fallback={<Trans>Back to the game</Trans>}>
                <Trans>Back to the result</Trans>
              </Show>
            }
            variant="solid"
            fullWidth
            onClick={() => props.onClose()}
            dataSet={{ testid: 'custom-game-back-to-live' }}
          />
        }
        aside={
          <Show
            when={wide()}
            fallback={
              <Show when={recordPlayed(props.record)}>
                <GameSection
                  title={<Trans>Every move</Trans>}
                  dataSet={{
                    component: 'CustomGameReview',
                    testid: 'custom-game-record',
                  }}
                >
                  <RecordMoves {...props} onSelect={props.onSeek} />
                </GameSection>
              </Show>
            }
          >
            <EveryMove {...props} />
          </Show>
        }
      >
        <GameBoardStage
          viewportFit={props.boardFit}
          align={props.boardAlign}
          dataSet={{ ...props.boardState, testid: 'custom-game-public' }}
          turn={<ReviewingLine record={props.record} />}
        >
          {props.board}
        </GameBoardStage>
        <FrameStatusView status={props.status} spokenOnly />
      </GameSessionLayout>
    </GameScreen>
  );
}
