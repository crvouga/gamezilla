import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { useSoundsPreference } from '@pkgs/sounds-client/solid';
import { useGamePresentation } from '@pkgs/turn-game-client/turn-games-context';
import { Button } from '@pkgs/ui-root-client/button';
import { GameBoardStage } from '@pkgs/ui-root-client/game-board-stage';
import { GameActions, GameSection } from '@pkgs/ui-root-client/game-section';
import { ChevronLeftIcon, ChevronRightIcon } from '@pkgs/ui-root-client/icons';
import { Select } from '@pkgs/ui-root-client/select';
import { TextInput } from '@pkgs/ui-root-client/text-input';
import { createMemo, createSignal, For, type JSX, Show } from 'solid-js';
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
    <div class="box flex-row items-end gap-2">
      <div class="box flex-1 min-w-0">
        <TextInput
          type="number"
          label={<Trans>Move number to review</Trans>}
          value={jump()}
          onChangeText={setJump}
          dataSet={{ testid: 'custom-game-review-ply' }}
        />
      </div>
      <Button
        title={<Trans>Review position</Trans>}
        variant="outline"
        intent="neutral"
        onClick={() => props.review.seek(Number(jump()))}
        dataSet={{ testid: 'custom-game-review-seek' }}
      />
    </div>
  );
}

function ReviewMoves(props: BoardProps): JSX.Element {
  const moves = () => props.review.game()?.moves ?? [];
  return (
    <Show
      when={moves().length > 0}
      fallback={
        <p class="text textCaption">
          <Trans>No moves yet.</Trans>
        </p>
      }
    >
      <ol class="box flex-row flex-wrap gap-1" aria-label={t`Moves played`}>
        <For each={moves()}>
          {(move, index) => (
            <li>
              <Button
                title={move.san}
                size="sm"
                variant={
                  props.review.displayedPly() === index() + 1
                    ? 'solid'
                    : 'ghost'
                }
                intent="neutral"
                onClick={() => props.review.seek(index() + 1)}
                dataSet={{ testid: `custom-game-review-move-${index() + 1}` }}
              />
            </li>
          )}
        </For>
      </ol>
    </Show>
  );
}

/** The game's record: its moves, and the earlier games of this space. */
export function CustomGameRecord(props: BoardProps): JSX.Element {
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
      <ReviewMoves {...props} />
      <ReviewSteps {...props} />
      <ReviewJump {...props} />
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
  const move = async (action: string): Promise<void> => {
    try {
      await props.model.choose({
        operation: 'move',
        uci: action,
        ply: props.model.current()?.moves.length ?? 0,
      });
    } catch {
      setReset((value) => value + 1);
    }
  };
  return (
    <GameBoardStage
      top={
        seated() ? (
          <CustomGameSeat
            model={props.model}
            side={near() === 'white' ? 'black' : 'white'}
          />
        ) : undefined
      }
      bottom={
        seated() ? (
          <div data-testid="custom-game-seat-near">
            <CustomGameSeat model={props.model} side={near()} />
          </div>
        ) : undefined
      }
    >
      <Dynamic
        component={presentation(props.review.fen()).Board}
        position={props.review.fen()}
        orientation={near()}
        interactive={interactive()}
        sound={!sounds.muted()}
        syncKey={reset()}
        testId="custom-game-board"
        setup={props.model.privateSetup.own()}
        onAction={(action: string) => {
          void move(action);
        }}
      />
    </GameBoardStage>
  );
}
