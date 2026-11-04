import { t } from '@lingui/core/macro';
import { Plural, Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameDisclosure } from '@pkgs/ui-root-client-ts/game-disclosure';
import {
  GameMoveList,
  type GameMoveListEntry,
} from '@pkgs/ui-root-client-ts/game-move-list';
import { GameActions, GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { IconButton } from '@pkgs/ui-root-client-ts/icon-button';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsRightIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { MoveStrip } from '@pkgs/ui-root-client-ts/move-strip';
import { Select } from '@pkgs/ui-root-client-ts/select';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { createMemo, createSignal, type JSX, Show } from 'solid-js';
import { FrameErrorView } from './game-frame-status-view';
import type { FrameRecord } from './game-frame-view-types';

/** Moving through the record: to a numbered position, back to the live one, or another game. */
export type FrameReviewHandlers = {
  readonly onSeek: (ply: number) => void;
  readonly onReturnLive: () => void;
  readonly onSelectRecord: (selection: string) => void;
  readonly onOpenHistory: () => void;
};

type RecordProps = FrameReviewHandlers & { readonly record: FrameRecord };

const STEP_SIZE = 32;

/** How many of the latest moves the record lists; earlier ones are reached by number. */
const LISTED_MOVES = 40;

/** The first listed ply's index: a long game lists only its latest moves. */
function firstListed(record: FrameRecord): number {
  return Math.max(0, record.moves.length - LISTED_MOVES);
}

/** Step back or forward a move, or return to the position being played. */
function StepBack(props: RecordProps): JSX.Element {
  return (
    <IconButton
      label={t`Previous move`}
      size={STEP_SIZE}
      disabled={props.record.displayedPly === 0}
      onClick={() => props.onSeek(props.record.displayedPly - 1)}
      dataSet={{ testid: 'custom-game-review-back' }}
    >
      <ChevronLeftIcon />
    </IconButton>
  );
}

function StepForward(props: RecordProps): JSX.Element {
  return (
    <IconButton
      label={t`Next move`}
      size={STEP_SIZE}
      disabled={props.record.displayedPly >= props.record.moves.length}
      onClick={() => props.onSeek(props.record.displayedPly + 1)}
      dataSet={{ testid: 'custom-game-review-forward' }}
    >
      <ChevronRightIcon />
    </IconButton>
  );
}

function ReturnLive(props: RecordProps): JSX.Element {
  return (
    <IconButton
      label={t`Return to current position`}
      size={STEP_SIZE}
      onClick={() => props.onReturnLive()}
      dataSet={{ testid: 'custom-game-review-live' }}
    >
      <ChevronsRightIcon />
    </IconButton>
  );
}

function ReviewJumpField(props: RecordProps): JSX.Element {
  const [jump, setJump] = createSignal(String(props.record.displayedPly));
  return (
    <StackHorizontal align="end" gap="sm">
      <StackVertical grow>
        <TextInput
          type="number"
          label={<Trans>Move number to review</Trans>}
          value={jump()}
          onChangeText={setJump}
          dataSet={{ testid: 'custom-game-review-ply' }}
        />
      </StackVertical>
      <Button
        title={<Trans>Review position</Trans>}
        variant="outline"
        intent="neutral"
        onClick={() => props.onSeek(Number(jump()))}
        dataSet={{ testid: 'custom-game-review-seek' }}
      />
    </StackHorizontal>
  );
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
 * The listed moves as numbered turns, each behind its mover's swatch; one
 * list for the strip under a phone's board and the table beside a wide one.
 */
function RecordMoves(
  props: RecordProps & { readonly layout: 'row' | 'table' }
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
      layout={props.layout}
      aria-label={t`Moves played`}
      perTurn={props.record.perTurn}
      current={props.record.displayedPly}
      moves={moves()}
      onSelect={(ply) => props.onSeek(ply)}
      leading={<EarlierMoves count={first()} />}
    />
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
        label={<Trans>Game record</Trans>}
        options={options()}
        value={props.record.selection}
        onValueChange={(value) => props.onSelectRecord(String(value))}
        dataSet={{ testid: 'custom-game-history' }}
      />
    </Show>
  );
}

/** Leaving for the space's history: an outline at its own width, never a filled bar. */
function RecordHistory(props: RecordProps): JSX.Element {
  return (
    <Show when={props.record.history}>
      <GameActions>
        <Button
          title={<Trans>History and stats</Trans>}
          variant="outline"
          intent="neutral"
          onClick={() => props.onOpenHistory()}
          dataSet={{ testid: 'custom-game-history-stats' }}
        />
      </GameActions>
    </Show>
  );
}

/**
 * The record beside a wide board: the moves as a table of turns, the steps
 * under it, a quiet disclosure to jump by number, then earlier games and
 * the space's history. A game played by turns lists its moves only once
 * there are any.
 */
function RecordPanel(props: RecordProps): JSX.Element {
  const played = (): boolean =>
    props.record.turns && props.record.moves.length > 0;
  return (
    <GameSection
      title={<Trans>Game record</Trans>}
      dataSet={{ component: 'CustomGameReview' }}
    >
      <RecordSelect {...props} />
      <Show when={played()}>
        <RecordMoves {...props} layout="table" />
        <StackHorizontal gap="xs" align="center">
          <StepBack {...props} />
          <StepForward {...props} />
          <ReturnLive {...props} />
        </StackHorizontal>
        <GameDisclosure
          title={<Trans>Go to a move by number</Trans>}
          dataSet={{ testid: 'custom-game-review-jump' }}
        >
          <ReviewJumpField {...props} />
        </GameDisclosure>
      </Show>
      <RecordHistory {...props} />
      <FrameErrorView text={props.record.error} />
    </GameSection>
  );
}

/**
 * The record under a phone's board, its one history control: the latest
 * moves in a strip between the steps, and the rest of the record (a move
 * by number, earlier games, the space's history) behind one disclosure.
 * The strip keeps its height before the first move, so the board above
 * never moves when it lands.
 */
function RecordStrip(props: RecordProps): JSX.Element {
  return (
    <StackVertical gap="xs" dataSet={{ component: 'CustomGameReview' }}>
      <MoveStrip
        testId="custom-game-move-strip"
        leading={<StepBack {...props} />}
        trailing={
          <>
            <StepForward {...props} />
            <ReturnLive {...props} />
          </>
        }
      >
        <RecordMoves {...props} layout="row" />
      </MoveStrip>
      <FrameErrorView text={props.record.error} />
      <GameDisclosure
        title={<Trans>Game record</Trans>}
        dataSet={{ testid: 'custom-game-review-jump' }}
      >
        <ReviewJumpField {...props} />
        <RecordSelect {...props} />
        <RecordHistory {...props} />
      </GameDisclosure>
    </StackVertical>
  );
}

/**
 * The game's record: its moves, and the earlier games of this space. A
 * game played by turns shows it as a strip under a phone's board
 * (`strip`) and as a panel beside a wide one (`panel`); a game without
 * turns always shows the panel.
 */
export function FrameRecordView(
  props: RecordProps & { readonly layout: 'panel' | 'strip' }
): JSX.Element {
  return (
    <Show
      when={props.layout === 'strip' && props.record.turns}
      fallback={<RecordPanel {...props} />}
    >
      <RecordStrip {...props} />
    </Show>
  );
}
