import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { useSoundsPreference } from '@pkgs/sounds-client-ts/solid';
import {
  useGamePresentation,
  useTurnGames,
} from '@pkgs/turn-game-client-ts/turn-games-context';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import { GameActions, GameSection } from '@pkgs/ui-root-client-ts/game-section';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { Select } from '@pkgs/ui-root-client-ts/select';
import { ListEntry, OrderedList } from '@pkgs/ui-root-client-ts/semantic-list';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import {
  createMemo,
  createSignal,
  For,
  Index,
  type JSX,
  Show,
} from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { customGameCanMove } from './custom-game-can-move';
import { CustomGameError } from './custom-game-error';
import { CustomGameSeat } from './custom-game-side';
import type { CustomGameReview } from './use-custom-game-review';
import type { CustomGameScreenModel } from './use-custom-game-screen';

type BoardProps = { model: CustomGameScreenModel; review: CustomGameReview };

/** Step through the moves, or return to the position being played. */
function ReviewSteps(props: BoardProps): JSX.Element {
  return (
    <GameActions>
      <Button
        title={<Trans>Previous move</Trans>}
        icon={ChevronLeftIcon}
        size="sm"
        variant="outline"
        intent="neutral"
        disabled={props.review.displayedPly() === 0}
        onClick={() => props.review.seek(props.review.displayedPly() - 1)}
        dataSet={{ testid: 'custom-game-review-back' }}
      />
      <Button
        title={<Trans>Next move</Trans>}
        icon={ChevronRightIcon}
        size="sm"
        variant="outline"
        intent="neutral"
        disabled={
          props.review.displayedPly() >=
          (props.review.game()?.moves.length ?? 0)
        }
        onClick={() => props.review.seek(props.review.displayedPly() + 1)}
        dataSet={{ testid: 'custom-game-review-forward' }}
      />
      <Button
        title={<Trans>Return to current position</Trans>}
        size="sm"
        variant="ghost"
        onClick={props.review.returnLive}
        dataSet={{ testid: 'custom-game-review-live' }}
      />
    </GameActions>
  );
}

/** Jump straight to a numbered position. */
function ReviewJump(props: BoardProps): JSX.Element {
  const [jump, setJump] = createSignal('0');
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
        onClick={() => props.review.seek(Number(jump()))}
        dataSet={{ testid: 'custom-game-review-seek' }}
      />
    </StackHorizontal>
  );
}

/** How many of the latest moves the record lists; earlier ones are reached by number. */
const LISTED_MOVES = 40;

function ReviewMoves(props: BoardProps): JSX.Element {
  const moves = () => props.review.game()?.moves ?? [];
  // The latest moves only: a long game (a Hearts game's every card) would
  // otherwise list hundreds; any earlier one is reached by its number.
  const first = createMemo(() => Math.max(0, moves().length - LISTED_MOVES));
  // Labels compare by value, so a move appended updates one row, not all.
  const labels = createMemo(() =>
    moves()
      .slice(first())
      .map((move) => move.san)
  );
  const earlier = () => first();
  return (
    <Show
      when={moves().length > 0}
      fallback={
        <P variant="caption" tone="secondary">
          <Trans>No moves yet.</Trans>
        </P>
      }
    >
      <Show when={earlier() > 0}>
        <P variant="caption" tone="secondary">
          <Trans>
            {earlier()} earlier moves. Review any of them by its move number.
          </Trans>
        </P>
      </Show>
      <StackHorizontal wrap gap="xs">
        <OrderedList aria-label={t`Moves played`} start={first() + 1}>
          {/* By position and label, not by object: each change parses fresh
              move objects, and a long game would otherwise rebuild its whole
              list on every move. */}
          <Index each={labels()}>
            {(label, index) => (
              <ListEntry>
                <Button
                  title={label()}
                  size="sm"
                  variant={
                    props.review.displayedPly() === first() + index + 1
                      ? 'solid'
                      : 'ghost'
                  }
                  intent="neutral"
                  onClick={() => props.review.seek(first() + index + 1)}
                  dataSet={{
                    testid: `custom-game-review-move-${first() + index + 1}`,
                  }}
                />
              </ListEntry>
            )}
          </Index>
        </OrderedList>
      </StackHorizontal>
    </Show>
  );
}

/** The game's record: its moves, and the earlier games of this space. */
export function CustomGameRecord(props: BoardProps): JSX.Element {
  const rules = useTurnGames();
  const hasTurns = () =>
    rules.turnsForPosition(props.review.fen()) !== undefined;
  const options = createMemo(() => [
    { value: 'live', label: <Trans>Current game</Trans> },
    ...props.model.games().history.map((game, index) => ({
      value: game.id,
      label: <Trans>Earlier game {index + 1}</Trans>,
    })),
  ]);
  return (
    <GameSection
      title={<Trans>Game record</Trans>}
      dataSet={{ component: 'CustomGameReview' }}
    >
      <Show when={props.model.games().history.length > 0}>
        <Select
          label={<Trans>Game record</Trans>}
          options={options()}
          value={props.review.selection()}
          onValueChange={(value) => props.review.select(String(value))}
          dataSet={{ testid: 'custom-game-history' }}
        />
      </Show>
      <Show when={hasTurns()}>
        <ReviewMoves {...props} />
        <ReviewSteps {...props} />
        <ReviewJump {...props} />
      </Show>
      <Show when={props.model.openHistory}>
        <Button
          title={<Trans>History and stats</Trans>}
          onClick={() => props.model.openHistory?.()}
          dataSet={{ testid: 'custom-game-history-stats' }}
        />
      </Show>
      <CustomGameError reason={props.review.error()} />
    </GameSection>
  );
}

/** One public render snapshot, so automated observers never combine different turns. */
function publicBoardState(props: BoardProps, canMove: boolean): string {
  const current = props.model.current();
  return JSON.stringify({
    position: props.review.fen(),
    status: current?.status ?? '',
    turn: current?.turn ?? '',
    outcome: current?.outcome ?? '',
    ply: current?.moves.length ?? 0,
    canMove,
  });
}

/**
 * The board. Once the game is under way the two seats sit around it, the
 * person's own side nearest them; while it is set up the seats are in the
 * Players section with their choices.
 */
export function CustomGameBoard(props: BoardProps): JSX.Element {
  const [reset, setReset] = createSignal(0);
  const sounds = useSoundsPreference();
  const near = () => props.model.mySide() ?? 'white';
  const seated = (): boolean => props.model.current()?.status !== 'configuring';
  const interactive = (): boolean =>
    customGameCanMove(props.model, props.review);
  const presentation = useGamePresentation();
  const simulation = props.model.simulation;
  const position = () =>
    props.review.live() && simulation.active()
      ? (simulation.position() ?? props.review.fen())
      : props.review.fen();
  const move = async (action: string): Promise<void> => {
    const game = props.model.current();
    const ply = game?.moves.length ?? 0;
    const side = props.model.mySide();
    try {
      // While every side commits, the board's gesture is this side's own
      // commitment; otherwise it is a move.
      await props.model.choose(
        side !== null && game?.awaiting.includes(side) === true
          ? { operation: 'commit', commitment: action, ply }
          : { operation: 'move', uci: action, ply }
      );
    } catch {
      setReset((value) => value + 1);
    }
  };
  return (
    <GameBoardStage
      dataSet={{
        testid: 'custom-game-public',
        state: publicBoardState(props, interactive()),
        fen: props.review.fen(),
        status: props.model.current()?.status ?? '',
        turn: props.model.current()?.turn ?? '',
        outcome: props.model.current()?.outcome ?? '',
        ply: String(props.model.current()?.moves.length ?? 0),
        canmove: String(interactive()),
      }}
      top={
        seated() ? (
          <StackVertical gap="sm">
            <For
              each={
                props.model
                  .current()
                  ?.sides.filter((side) => side !== near()) ?? []
              }
            >
              {(side) => <CustomGameSeat model={props.model} side={side} />}
            </For>
          </StackVertical>
        ) : undefined
      }
      bottom={
        seated() ? (
          <StackVertical testId="custom-game-seat-near">
            <CustomGameSeat model={props.model} side={near()} />
          </StackVertical>
        ) : undefined
      }
    >
      <Dynamic
        component={presentation(position()).Board}
        position={position()}
        simulation={
          props.review.live() && simulation.active()
            ? simulation.controls()
            : undefined
        }
        orientation={near()}
        interactive={interactive()}
        sound={!sounds.muted()}
        syncKey={reset()}
        testId="custom-game-board"
        setup={props.model.privateSetup.own()}
        hand={props.model.ownHand()}
        committed={props.model.current()?.committed ?? []}
        commitment={props.model.ownCommitment()}
        onAction={(action: string) => {
          void move(action);
        }}
      />
      <CustomGameError
        reason={
          simulation.error()
            ? t`The game stopped. Your last saved score is kept. Reopen the game to try again.`
            : ''
        }
      />
    </GameBoardStage>
  );
}
