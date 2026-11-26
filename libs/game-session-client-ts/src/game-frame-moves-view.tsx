import { t } from '@lingui/core/macro';
import { Plural, Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import {
  GameMoveList,
  type GameMoveListEntry,
} from '@pkgs/ui-root-client-ts/game-move-list';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { GameSeatSwatch } from '@pkgs/ui-root-client-ts/game-seat-swatch';
import { GameSection } from '@pkgs/ui-root-client-ts/game-section';
import {
  FixedGameSession,
  StageDetails,
} from '@pkgs/ui-root-client-ts/game-session-layout';
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
import type { JSX } from '@solidjs/web';
import { createMemo, createSignal, For, Show, untrack } from 'solid-js';
import type { FramePlaceProps } from './custom-game-screen-view';
import { FrameNoticesView } from './game-frame-shell';
import { FrameStage } from './game-frame-stage';
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
 * A move's name, its game's word for bare numbers said with it (`Move 9 ·
 * column 7, Red circle`), so a move reads whole wherever it is listed.
 */
function moveName(
  ply: number,
  label: string,
  record: FrameRecord,
  side: string | undefined
): string {
  const word = record.moveHeading ?? '';
  const move = word === '' ? label : `${word.toLowerCase()} ${label}`;
  return side === undefined
    ? t`Move ${ply} · ${move}`
    : t`Move ${ply} · ${move}, ${side}`;
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
        accessibleName: moveName(ply, label, props.record, mover?.sideLabel),
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
      stripKey={t`Moves`}
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

/** The history strip opens a selected move on the review board. */
export function FrameMovesCard(props: Props): JSX.Element {
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
  // Prefilled once with the move shown as the field opens: what the person
  // types is theirs, and stepping through the moves does not rewrite it.
  const [jump, setJump] = createSignal(
    untrack(() => String(props.record.displayedPly))
  );
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

/**
 * The moves place: the board at one position of the record, the four
 * steps under it, and every move beside it. It never plays: leaving it
 * returns the board to the game as it stands.
 */
export function FrameMovesPlace(props: RecordProps): JSX.Element {
  const over = (): boolean =>
    props.phase === 'completed' || props.phase === 'cancelled';
  return (
    <GameScreen
      screenId="custom-game-stage-moves"
      title={<Trans>Moves</Trans>}
      compactInset={props.table.compactInset}
    >
      <FixedGameSession
        dataSet={{
          component: 'CustomGameContent',
          testid: 'custom-game-content',
          phase: props.phase,
          place: props.place.screen,
        }}
        notices={
          <FrameNoticesView connection={props.connection} error={props.error} />
        }
        status={<ReviewingLine record={props.record} />}
        actions={
          <>
            <RecordSteps {...props} />
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
          </>
        }
        history={
          <>
            <Show when={recordPlayed(props.record)}>
              <RecordMoves {...props} onSelect={props.onSeek} />
            </Show>
            <StageDetails label={t`Go to move`} testId="custom-game-go-to-move">
              <RecordSelect {...props} />
              <ReviewJumpField {...props} />
              <FrameErrorView text={props.record.error} />
            </StageDetails>
          </>
        }
      >
        {(information) => (
          <>
            <FrameStage {...props} information={information} />
            <FrameStatusView status={props.status} spokenOnly />
          </>
        )}
      </FixedGameSession>
    </GameScreen>
  );
}
