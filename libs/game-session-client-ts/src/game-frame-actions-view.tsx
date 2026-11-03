import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameActionBar } from '@pkgs/ui-root-client-ts/game-action-bar';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import { createSignal, type JSX, Show } from 'solid-js';
import type { FrameNext, FramePhase, FramePlay } from './game-frame-view-types';

type Choose = (input: CustomGameInput) => Promise<void>;

/**
 * Resigning or cancelling, confirmed first. The dialog outlives the button:
 * the confirmed choice finishes the game, which removes the button.
 */
export function FrameConfirmView(props: {
  readonly operation: 'cancel' | 'resign';
  readonly available: boolean;
  readonly onChoose: Choose;
}): JSX.Element {
  // A new press replaces a dialog left on its error step.
  const [dialogSession, setDialogSession] = createSignal(0);
  const title = (): JSX.Element => (
    <Show
      when={props.operation === 'cancel'}
      fallback={<Trans>Resign game</Trans>}
    >
      <Trans>Cancel game</Trans>
    </Show>
  );
  // The row sits under the board, so the button need not repeat "game".
  const action = (): JSX.Element => (
    <Show
      when={props.operation === 'cancel'}
      fallback={
        <Trans>
          Resign<VisuallyHidden> game</VisuallyHidden>
        </Trans>
      }
    >
      <Trans>Cancel game</Trans>
    </Show>
  );
  return (
    <>
      <Show when={props.available}>
        <Button
          title={action()}
          intent="danger"
          variant="ghost"
          onClick={() => setDialogSession((current) => current + 1)}
          dataSet={{ testid: `custom-game-${props.operation}` }}
        />
      </Show>
      <Show when={dialogSession()} keyed>
        {(session) => (
          <MutationModal
            visible={session > 0}
            onClose={() => setDialogSession(0)}
            title={title()}
            message={
              <Trans>
                This finishes the current game. Its record remains available.
              </Trans>
            }
            operation={() => props.onChoose({ operation: props.operation })}
            submitLabel={title()}
            variant="destructive"
            successTitle={<Trans>Game finished</Trans>}
            submitDataSet={{
              testid: `custom-game-${props.operation}-confirm`,
            }}
            dismissDataSet={{ testid: `custom-game-${props.operation}-done` }}
          />
        )}
      </Show>
    </>
  );
}

/** The draw choices and the claimed win, in the game's action row. */
function FrameDrawActions(props: {
  readonly play: FramePlay;
  readonly onChoose: Choose;
}): JSX.Element {
  return (
    <>
      <Show when={props.play.canOfferDraw}>
        <GameActionButton
          title={<Trans>Offer draw</Trans>}
          dataSet={{ testid: 'custom-game-offer' }}
          operation={() => props.onChoose({ operation: 'offer' })}
        />
      </Show>
      <Show when={props.play.canAnswerDraw}>
        <GameActionButton
          title={<Trans>Agree draw</Trans>}
          variant="solid"
          dataSet={{ testid: 'custom-game-agree' }}
          operation={() => props.onChoose({ operation: 'agree' })}
        />
        <GameActionButton
          title={<Trans>Decline draw</Trans>}
          dataSet={{ testid: 'custom-game-reject' }}
          operation={() => props.onChoose({ operation: 'reject' })}
        />
      </Show>
      <Show when={props.play.canClaimWin}>
        <GameActionButton
          title={<Trans>Claim the win</Trans>}
          variant="solid"
          dataSet={{ testid: 'custom-game-claim-win' }}
          operation={() => props.onChoose({ operation: 'claimWin' })}
        />
      </Show>
    </>
  );
}

/**
 * Once the game is over: someone who played (or may set up the next game)
 * is offered the rematch, a new game with other choices and the review;
 * someone watching goes back to the space or reviews.
 */
function FrameNextActions(props: {
  readonly next: FrameNext;
  readonly onChoose: Choose;
  readonly onBack: () => void;
  readonly onSeek: (ply: number) => void;
}): JSX.Element {
  return (
    <GameActionBar aria-label={t`What next`} items={[]}>
      <Show
        when={props.next.plays}
        fallback={
          <Button
            title={<Trans>Back to the space</Trans>}
            variant="outline"
            intent="neutral"
            onClick={() => props.onBack()}
            dataSet={{ testid: 'custom-game-back' }}
          />
        }
      >
        <Show when={props.next.canCreate}>
          <GameActionButton
            title={<Trans>Rematch</Trans>}
            variant="solid"
            dataSet={{ testid: 'custom-game-rematch' }}
            operation={() => props.onChoose({ operation: 'rematch' })}
          />
          <GameActionButton
            title={<Trans>Change game</Trans>}
            dataSet={{ testid: 'custom-game-new' }}
            operation={() => props.onChoose({ operation: 'create' })}
          />
        </Show>
      </Show>
      <Show when={props.next.reviewable}>
        <Button
          title={<Trans>Review</Trans>}
          variant="outline"
          intent="neutral"
          onClick={() => props.onSeek(0)}
          dataSet={{ testid: 'custom-game-review-start' }}
        />
      </Show>
    </GameActionBar>
  );
}

/**
 * The game's commands: while it is set up or played, the board's actions
 * and the frame's own (draw offers, claiming the win, resigning,
 * cancelling); once it is over, what comes next.
 */
export function FrameActionsView(props: {
  readonly phase: FramePhase;
  readonly play: FramePlay;
  readonly next: FrameNext;
  readonly onChoose: Choose;
  readonly onBack: () => void;
  readonly onSeek: (ply: number) => void;
}): JSX.Element {
  const unfinished = () =>
    props.phase === 'configuring' || props.phase === 'active';
  const over = () => props.phase === 'completed' || props.phase === 'cancelled';
  return (
    <Show when={props.phase !== 'none'}>
      {/* Confirmation dialogs outlive the command row when their mutation finishes the game. */}
      <GameActionBar
        aria-label={t`Game actions`}
        items={unfinished() ? props.play.boardActions : []}
      >
        <Show when={props.phase === 'active'}>
          <FrameDrawActions play={props.play} onChoose={props.onChoose} />
        </Show>
        <FrameConfirmView
          operation="resign"
          available={props.play.canResign}
          onChoose={props.onChoose}
        />
        <FrameConfirmView
          operation="cancel"
          available={props.play.canCancel}
          onChoose={props.onChoose}
        />
      </GameActionBar>
      <Show when={over()}>
        <FrameNextActions
          next={props.next}
          onChoose={props.onChoose}
          onBack={props.onBack}
          onSeek={props.onSeek}
        />
      </Show>
    </Show>
  );
}
