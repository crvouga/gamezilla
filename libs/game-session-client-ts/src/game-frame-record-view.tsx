import { t } from '@lingui/core/macro';
import { Plural, Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import {
  GameMoveList,
  type GameMoveListEntry,
} from '@pkgs/ui-root-client-ts/game-move-list';
import { GameActions, GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { GameTurnPill } from '@pkgs/ui-root-client-ts/game-turn-pill';
import { IconButton } from '@pkgs/ui-root-client-ts/icon-button';
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ChevronUpIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { MoveStrip } from '@pkgs/ui-root-client-ts/move-strip';
import { Select } from '@pkgs/ui-root-client-ts/select';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { StatusDot } from '@pkgs/ui-root-client-ts/status-dot';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
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

type RecordProps = FrameReviewHandlers & {
  readonly record: FrameRecord;
  /**
   * The game's commands, beside a wide board: the foot of the record's own
   * card, right under its steps, so the rail is one card as tall as what
   * it holds.
   */
  readonly commands?: JSX.Element | undefined;
  /**
   * The game's line about what happens now, under the card's title, while
   * the record holds no move yet (beside a wide board: Hearts while hands
   * are passed), so the card is never empty.
   */
  readonly caption?: string | undefined;
};

/**
 * While the board shows an earlier position every step is a bounded disc
 * on the sunken well, so the way through the record reads as the control
 * in hand. During live play the steps are quiet glyphs with no plate, so
 * they never outweigh the board and the game's commands.
 */
const STEP_SIZE = 36;
const STEP_PLATE = 'surfaceMuted';

/** The steps' plate: shown only while reviewing an earlier position. */
function stepPlate(record: FrameRecord): typeof STEP_PLATE | undefined {
  return recordReviewing(record) ? STEP_PLATE : undefined;
}

/** How many of the latest moves the record lists; earlier ones are reached by number. */
const LISTED_MOVES = 40;

/** The first listed ply's index: a long game lists only its latest moves. */
function firstListed(record: FrameRecord): number {
  return Math.max(0, record.moves.length - LISTED_MOVES);
}

type StepProps = RecordProps & { readonly size?: number | undefined };

/** Back to the opening position, before the first move. */
function StepToStart(props: StepProps): JSX.Element {
  return (
    <IconButton
      label={t`Go to the start`}
      size={props.size ?? STEP_SIZE}
      background={stepPlate(props.record)}
      disabled={props.record.displayedPly === 0}
      onClick={() => props.onSeek(0)}
      dataSet={{ testid: 'custom-game-review-first' }}
    >
      <ChevronsLeftIcon />
    </IconButton>
  );
}

/** Step back or forward a move, or return to the position being played. */
function StepBack(props: StepProps): JSX.Element {
  return (
    <IconButton
      label={t`Previous move`}
      size={props.size ?? STEP_SIZE}
      background={stepPlate(props.record)}
      disabled={props.record.displayedPly === 0}
      onClick={() => props.onSeek(props.record.displayedPly - 1)}
      dataSet={{ testid: 'custom-game-review-back' }}
    >
      <ChevronLeftIcon />
    </IconButton>
  );
}

function StepForward(props: StepProps): JSX.Element {
  return (
    <IconButton
      label={t`Next move`}
      size={props.size ?? STEP_SIZE}
      background={stepPlate(props.record)}
      disabled={props.record.displayedPly >= props.record.moves.length}
      onClick={() => props.onSeek(props.record.displayedPly + 1)}
      dataSet={{ testid: 'custom-game-review-forward' }}
    >
      <ChevronRightIcon />
    </IconButton>
  );
}

function ReturnLive(props: StepProps): JSX.Element {
  return (
    <IconButton
      label={t`Return to current position`}
      size={props.size ?? STEP_SIZE}
      background={stepPlate(props.record)}
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

/** The shown turn's number in words, for the strip under a phone's board. */
function turnWords(turn: number): JSX.Element {
  return <Trans>Move {turn}</Trans>;
}

/**
 * The listed moves as numbered turns, each behind its mover's swatch (and
 * the game's word for a bare-number move, `col 3`): the shown turn in the
 * strip under a phone's board, named `Move 4` (any turn can be stepped
 * to), the latest moves in the table beside a wide one.
 */
function RecordMoves(
  props: RecordProps & {
    readonly layout: 'turn' | 'table';
    /** The full list behind the phone strip: its moves leave their ids to the strip. */
    readonly besideStrip?: boolean | undefined;
  }
): JSX.Element {
  const first = createMemo(() =>
    props.layout === 'table' ? firstListed(props.record) : 0
  );
  const moves = createMemo((): readonly GameMoveListEntry[] =>
    props.record.moves.slice(first()).map((label, index) => {
      const ply = first() + index + 1;
      const mover = props.record.movers[ply - 1];
      return {
        ply,
        label,
        swatch: mover?.swatch,
        prefix:
          props.record.movePrefix === undefined ||
          props.record.movePrefix === ''
            ? undefined
            : props.record.movePrefix,
        accessibleName:
          mover === undefined
            ? t`Move ${ply}: ${label}`
            : t`Move ${ply}, ${mover.sideLabel}: ${label}`,
        testId:
          props.besideStrip === true
            ? undefined
            : `custom-game-review-move-${ply}`,
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
      turnLabel={turnWords}
      wrap
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

/**
 * Leaving for the space's history: never a filled bar. Always in one
 * place, at the end of the game's commands (beside Resign under a phone's
 * board, at the foot of the record's card beside a wide one); quiet there,
 * so it never weighs as much as a play command.
 */
function HistoryButton(
  props: Pick<RecordProps, 'record' | 'onOpenHistory'> & {
    readonly quiet?: boolean | undefined;
  }
): JSX.Element {
  return (
    <Show when={props.record.history}>
      <Button
        title={<Trans>History and stats</Trans>}
        variant={props.quiet === true ? 'ghost' : 'outline'}
        size={props.quiet === true ? 'sm' : undefined}
        intent="neutral"
        endIcon={props.quiet === true ? <ChevronRightIcon /> : undefined}
        onClick={() => props.onOpenHistory()}
        dataSet={{ testid: 'custom-game-history-stats' }}
      />
    </Show>
  );
}

/**
 * The way to the space's history on its own, for a game with no moves to
 * list (one played in real time): quiet at a card's title, or an outline
 * beside the game's commands.
 */
export function FrameHistoryLink(
  props: Pick<RecordProps, 'record' | 'onOpenHistory'> & {
    readonly quiet?: boolean | undefined;
  }
): JSX.Element {
  return <HistoryButton {...props} />;
}

/**
 * The steps through the record, in order: to the start, back a move,
 * forward a move, back to the position being played.
 */
function RecordSteps(props: RecordProps): JSX.Element {
  return (
    <StackHorizontal gap="xs" align="center">
      <StepToStart {...props} />
      <StepBack {...props} />
      <StepForward {...props} />
      <ReturnLive {...props} />
    </StackHorizontal>
  );
}

/**
 * Opens and closes the rest of the record in place: a quiet button that
 * says what it shows and whether it is open (`aria-expanded`), never a
 * row of its own.
 */
function RecordToggle(props: {
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly title: JSX.Element;
}): JSX.Element {
  return (
    <Button
      title={props.title}
      variant="ghost"
      intent="neutral"
      size="sm"
      aria-expanded={props.open}
      endIcon={
        <Show when={props.open} fallback={<ChevronDownIcon size={16} />}>
          <ChevronUpIcon size={16} />
        </Show>
      }
      onClick={() => props.onToggle()}
      dataSet={{ testid: 'custom-game-review-jump' }}
    />
  );
}

/**
 * The phone's toggle for the rest of the record: a chevron on a plate,
 * named for assistive technology, so the shown turn keeps its line's
 * width.
 */
function RecordIconToggle(props: {
  readonly open: boolean;
  readonly onToggle: () => void;
}): JSX.Element {
  return (
    <IconButton
      label={props.open ? t`Hide all moves` : t`All moves`}
      size={STEP_SIZE}
      background={STEP_PLATE}
      aria-expanded={props.open}
      onClick={() => props.onToggle()}
      dataSet={{ testid: 'custom-game-review-jump' }}
    >
      <Show when={props.open} fallback={<ChevronDownIcon />}>
        <ChevronUpIcon />
      </Show>
    </IconButton>
  );
}

/**
 * The record beside a wide board, one card as tall as what it holds: the
 * moves as a table of turns, the steps right under them with a quiet way
 * to jump to a move by number, then the game's commands as the card's
 * foot (`commands`: Offer draw, Resign), so the whole rail reads as one
 * unit with no gap. The space's history is a quiet link at the end of
 * those commands, where every game keeps it; a long game's table scrolls
 * inside. A game played by turns lists its
 * moves only once there are any.
 */
function RecordPanel(props: RecordProps): JSX.Element {
  const [jumping, setJumping] = createSignal(false);
  const played = (): boolean =>
    props.record.turns && props.record.moves.length > 0;
  return (
    <GameSection
      title={<Trans>Game record</Trans>}
      description={props.caption}
      dataSet={{ component: 'CustomGameReview' }}
      footer={
        <GameActions>
          {props.commands}
          <HistoryButton {...props} quiet />
        </GameActions>
      }
    >
      <RecordSelect {...props} />
      <Show when={played()}>
        <StackVertical gap="sm">
          <RecordMoves {...props} layout="table" />
          <StackHorizontal justify="between" align="center" gap="sm" wrap>
            <RecordSteps {...props} />
            <RecordToggle
              open={jumping()}
              onToggle={() => setJumping(!jumping())}
              title={<Trans>Go to move</Trans>}
            />
          </StackHorizontal>
          <Show when={jumping()}>
            <ReviewJumpField {...props} />
          </Show>
        </StackVertical>
      </Show>
      <FrameErrorView text={props.record.error} />
    </GameSection>
  );
}

/**
 * At the record's head under a phone's board, in words, whether the board
 * shows the game as it stands: a live dot and `Live`, or a warning dot and
 * `Reviewing move 3 of 6` (the board's own banner and the last step offer
 * the way back).
 */
function StripPlace(props: { readonly record: FrameRecord }): JSX.Element {
  return (
    <Show when={props.record.moves.length > 0}>
      <StackHorizontal align="center" gap="xs" shrink>
        <StatusDot
          status={recordReviewing(props.record) ? 'warning' : 'online'}
          size={8}
        />
        <P variant="label" testId="custom-game-move-strip-place">
          <Show
            when={recordReviewing(props.record)}
            fallback={<Trans>Live</Trans>}
          >
            <Trans>
              Reviewing move {props.record.displayedPly} of{' '}
              {props.record.moves.length}
            </Trans>
          </Show>
        </P>
      </StackHorizontal>
    </Show>
  );
}

/**
 * A phone's record as one compact strip pinned under the host's top bar:
 * the game's own line about the turn when it says more than the seat to
 * move does (`caption`), then one row: whether the board is live, the
 * shown turn in words on a well of its own (`Move 4 · ● col 3 · ◆ col 2`),
 * wrapping between its moves rather than cutting one at the well's edge,
 * and the chevron that opens the rest of the record in place. During live
 * play the four steps wait behind that chevron with every move, a move
 * by number and earlier games, so
 * nothing competes with play; while an earlier position is reviewed they
 * come out beside the place it shows. The well keeps its height before
 * the first move (saying there is none yet), so the board under it never
 * moves when it lands.
 */
function RecordStrip(props: RecordProps): JSX.Element {
  const [open, setOpen] = createSignal(false);
  const reviewing = (): boolean => recordReviewing(props.record);
  return (
    <Surface
      tone="surface"
      border
      radius="card"
      paddingX="sm"
      paddingY="xs"
      gap="xs"
      testId="custom-game-record"
    >
      <Show when={props.caption}>
        {(caption) => (
          <P variant="label" testId="custom-game-record-caption">
            {caption()}
          </P>
        )}
      </Show>
      <StackHorizontal
        align="center"
        gap="sm"
        testId="custom-game-move-strip-head"
      >
        <Show when={!reviewing()}>
          <StripPlace record={props.record} />
        </Show>
        <Surface tone="muted" radius="control" grow>
          <MoveStrip testId="custom-game-move-strip" overflow="wrap">
            <Show
              when={props.record.moves.length > 0}
              fallback={
                <StackHorizontal paddingX="md">
                  <P variant="caption" tone="secondary">
                    <Trans>No moves yet.</Trans>
                  </P>
                </StackHorizontal>
              }
            >
              <RecordMoves {...props} layout="turn" />
            </Show>
          </MoveStrip>
        </Surface>
        <RecordIconToggle open={open()} onToggle={() => setOpen(!open())} />
      </StackHorizontal>
      <Show when={reviewing() || open()}>
        <StackHorizontal
          justify={reviewing() ? 'between' : 'end'}
          align="center"
          gap="sm"
          testId="custom-game-record-steps"
        >
          <Show when={reviewing()}>
            <StripPlace record={props.record} />
          </Show>
          <RecordSteps {...props} />
        </StackHorizontal>
      </Show>
      <FrameErrorView text={props.record.error} />
      <Show when={open()}>
        <StackVertical gap="md" paddingY="sm">
          <Show when={props.record.moves.length > 0}>
            <RecordMoves {...props} layout="table" besideStrip />
          </Show>
          <ReviewJumpField {...props} />
          <RecordSelect {...props} />
        </StackVertical>
      </Show>
    </Surface>
  );
}

/**
 * The game's record: its moves, and the earlier games of this space. A
 * game played by turns shows it as a compact card under a phone's board
 * (`strip`) and as a panel beside a wide one (`panel`); a game without
 * turns always shows the panel. Beside a wide board the game's commands
 * close the panel's own card, right under its steps.
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

/** The record shows an earlier position, or an earlier game, not the live one. */
export function recordReviewing(record: FrameRecord | null): boolean {
  return (
    record !== null &&
    (record.selection !== 'live' || record.displayedPly < record.moves.length)
  );
}

/**
 * Right by the board while it shows an earlier position: which one, in
 * words, and one prominent step back to the game as it stands. Nothing
 * while the board is live, so the record's own steps stay secondary then.
 */
export function FrameReviewingView(
  props: Pick<FrameReviewHandlers, 'onReturnLive'> & {
    readonly record: FrameRecord | null;
  }
): JSX.Element {
  return (
    <Show when={recordReviewing(props.record) ? props.record : null}>
      {(record) => (
        <GameTurnPill
          live
          tone="warning"
          dataSet={{ testid: 'custom-game-reviewing' }}
          title={
            <Show
              when={record().displayedPly > 0}
              fallback={<Trans>Reviewing the starting position</Trans>}
            >
              <Show
                when={record().selection === 'live'}
                fallback={
                  <Trans>
                    Reviewing an earlier game, move {record().displayedPly}
                  </Trans>
                }
              >
                <Trans>
                  Reviewing move {record().displayedPly} of{' '}
                  {record().moves.length}
                </Trans>
              </Show>
            </Show>
          }
          trailing={
            <Button
              title={<Trans>Back to live</Trans>}
              size="sm"
              variant="solid"
              onClick={() => props.onReturnLive()}
              dataSet={{ testid: 'custom-game-back-to-live' }}
            />
          }
        />
      )}
    </Show>
  );
}
