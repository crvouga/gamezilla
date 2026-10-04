import { Trans } from '@lingui/solid/macro';
import { ChessBoard } from '@pkgs/chess-board-root-client/chess-board';
import type { Move } from '@pkgs/chess-board-core-shared/types';
import { useSoundsPreference } from '@pkgs/sounds-client/solid';
import { Button } from '@pkgs/ui-root-client/button';
import { Select } from '@pkgs/ui-root-client/select';
import { TextInput } from '@pkgs/ui-root-client/text-input';
import { createMemo, createSignal, For, type JSX, Show } from 'solid-js';
import { CustomGameError } from './custom-game-error';
import type { CustomGameReview } from './use-custom-game-review';
import type { CustomGameScreenModel } from './use-custom-game-screen';

function CustomGameReviewControls(props: {
  model: CustomGameScreenModel;
  review: CustomGameReview;
}): JSX.Element {
  const [jump, setJump] = createSignal('0');
  const options = createMemo(() => [
    { value: 'live', label: <Trans>Current game</Trans> },
    ...props.model.games().history.map((game, index) => ({
      value: game.id,
      label: <Trans>Earlier game {index + 1}</Trans>,
    })),
  ]);
  return (
    <div class="box gap-3" data-component="CustomGameReview">
      <Show when={props.model.games().history.length > 0}>
        <Select
          label={<Trans>Game record</Trans>}
          options={options()}
          value={props.review.selection()}
          onValueChange={(value) => props.review.select(String(value))}
          dataSet={{ testid: 'chess-custom-history' }}
        />
      </Show>
      <div class="box flex-row gap-2 flex-wrap">
        <Button
          title={<Trans>Previous move</Trans>}
          variant="outline"
          disabled={props.review.displayedPly() === 0}
          onClick={() => props.review.seek(props.review.displayedPly() - 1)}
          dataSet={{ testid: 'chess-custom-review-back' }}
        />
        <Button
          title={<Trans>Next move</Trans>}
          variant="outline"
          disabled={
            props.review.displayedPly() >=
            (props.review.game()?.moves.length ?? 0)
          }
          onClick={() => props.review.seek(props.review.displayedPly() + 1)}
          dataSet={{ testid: 'chess-custom-review-forward' }}
        />
        <Button
          title={<Trans>Return to current position</Trans>}
          variant="ghost"
          onClick={props.review.returnLive}
          dataSet={{ testid: 'chess-custom-review-live' }}
        />
      </div>
      <TextInput
        type="number"
        label={<Trans>Move number to review</Trans>}
        value={jump()}
        onChangeText={setJump}
        dataSet={{ testid: 'chess-custom-review-ply' }}
      />
      <Button
        title={<Trans>Review position</Trans>}
        variant="ghost"
        onClick={() => props.review.seek(Number(jump()))}
        dataSet={{ testid: 'chess-custom-review-seek' }}
      />
      <CustomGameError reason={props.review.error()} />
      <ol class="box flex-row flex-wrap gap-2" aria-label="Moves played">
        <For each={props.review.game()?.moves ?? []}>
          {(move, index) => (
            <li>
              <Button
                title={move.san}
                size="sm"
                variant="ghost"
                onClick={() => props.review.seek(index() + 1)}
                dataSet={{ testid: `chess-custom-review-move-${index() + 1}` }}
              />
            </li>
          )}
        </For>
      </ol>
    </div>
  );
}

export function CustomGameBoard(props: {
  model: CustomGameScreenModel;
  review: CustomGameReview;
}): JSX.Element {
  const [reset, setReset] = createSignal(0);
  const sounds = useSoundsPreference();
  const interactive = (): boolean =>
    props.review.live() &&
    props.model.current()?.status === 'active' &&
    props.model.mySide() === props.model.current()?.turn &&
    props.model.canPlay() &&
    props.model.connected();
  const move = async (choice: Move): Promise<void> => {
    try {
      await props.model.choose({
        operation: 'move',
        uci: choice.from + choice.to + (choice.promotion ?? ''),
        ply: props.model.current()?.moves.length ?? 0,
      });
    } catch {
      setReset((value) => value + 1);
    }
  };
  return (
    <div class="box gap-4" data-component="CustomGameBoard">
      <div class="w-full max-w-lg self-center">
        <ChessBoard
          fen={props.review.fen()}
          fenSyncKey={reset()}
          orientation={props.model.mySide() ?? 'white'}
          interactive={interactive()}
          sound={!sounds.muted()}
          onMove={(choice) => {
            void move(choice);
          }}
          autoPromoteQueen={false}
          showCoordinates
          highlightLastMove
          highlightLegalMoves
          dataSet={{ testid: 'chess-custom-board' }}
        />
      </div>
      <CustomGameReviewControls {...props} />
    </div>
  );
}
