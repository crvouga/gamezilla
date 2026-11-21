import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import { GameActions } from '@pkgs/ui-root-client-ts/game-section';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { type Accessor, createSignal, type JSX, Show } from 'solid-js';
import type { GameFrameScreenViewProps } from './game-frame-screen-view';
import {
  FrameConnectionView,
  FrameErrorView,
  FrameStatusView,
} from './game-frame-status-view';

type Choose = (input: CustomGameInput) => Promise<void>;

/** A command that finishes the game, so it is confirmed first. */
export type FrameConfirmOperation = 'cancel' | 'resign';

/**
 * The frame's one confirmation, owned by the frame and not by the place
 * that asked for it: the confirmed choice finishes the game, which takes
 * the place away, and the dialog must still say it worked.
 */
export type FrameConfirm = {
  /** The command being confirmed, with the press that asked: a new press replaces a dialog left on its error step. */
  readonly asked: Accessor<{
    readonly operation: FrameConfirmOperation;
    readonly session: number;
  } | null>;
  readonly ask: (operation: FrameConfirmOperation) => void;
  readonly close: () => void;
};

export function createFrameConfirm(): FrameConfirm {
  const [asked, setAsked] = createSignal<{
    readonly operation: FrameConfirmOperation;
    readonly session: number;
  } | null>(null);
  let presses = 0;
  return {
    asked,
    ask: (operation) => {
      presses += 1;
      setAsked({ operation, session: presses });
    },
    close: () => setAsked(null),
  };
}

/** Resigning or cancelling, confirmed: over whichever place is shown. */
export function FrameConfirmDialog(props: {
  readonly confirm: FrameConfirm;
  readonly onChoose: Choose;
}): JSX.Element {
  return (
    <Show when={props.confirm.asked()} keyed>
      {(asked) => {
        const title = (): JSX.Element => (
          <Show
            when={asked.operation === 'cancel'}
            fallback={<Trans>Resign game</Trans>}
          >
            <Trans>Cancel game</Trans>
          </Show>
        );
        return (
          <MutationModal
            visible
            onClose={() => props.confirm.close()}
            title={title()}
            message={
              <Show
                when={asked.operation === 'cancel'}
                fallback={
                  <Trans>
                    You lose this game. Its moves stay in the space's history.
                  </Trans>
                }
              >
                <Trans>
                  The game ends for everyone, with no result. Its moves stay in
                  the space's history.
                </Trans>
              </Show>
            }
            cancelLabel={
              <Show
                when={asked.operation === 'cancel'}
                fallback={<Trans>Keep playing</Trans>}
              >
                <Trans>Keep the game</Trans>
              </Show>
            }
            operation={() => props.onChoose({ operation: asked.operation })}
            submitLabel={title()}
            variant="destructive"
            successTitle={<Trans>Game finished</Trans>}
            submitDataSet={{ testid: `custom-game-${asked.operation}-confirm` }}
            dismissDataSet={{ testid: `custom-game-${asked.operation}-done` }}
          />
        );
      }}
    </Show>
  );
}

/** What every place says first: the connection, then a refused choice. */
export function FrameNoticesView(
  props: Pick<GameFrameScreenViewProps, 'connection' | 'error'> & {
    /** Before any game: the notice speaks of starting one, not of moves. */
    readonly beforeGame?: boolean | undefined;
  }
): JSX.Element {
  return (
    <>
      <FrameConnectionView
        connection={props.connection}
        beforeGame={props.beforeGame}
      />
      <FrameErrorView text={props.error} />
    </>
  );
}

/**
 * A place of the custom game with no board: a hub, a choice or a form, one
 * column at a menu's measure. It opens with the frame's notices and ends
 * with the game's line for a listener, so every place says where the game
 * stands.
 */
export function FramePlacePage(
  props: Pick<
    GameFrameScreenViewProps,
    'connection' | 'error' | 'status' | 'phase' | 'place'
  > & {
    /** `custom-game-${place}`. */
    readonly screenId: string;
    /** Omit when the place opens with its own title (a mode card). */
    readonly title?: JSX.Element | undefined;
    readonly subtitle?: JSX.Element | undefined;
    /**
     * The words of the way back to where this place was opened from
     * (`Back to setup`), at the page's foot: the host's bar names the
     * space, not the game, so the page says it itself.
     */
    readonly back?: JSX.Element | undefined;
    readonly onClose?: (() => void) | undefined;
    readonly children: JSX.Element;
  }
): JSX.Element {
  return (
    <EmbeddedScreen
      screenId={props.screenId}
      title={props.title}
      subtitle={props.subtitle}
    >
      <StackVertical
        gap="lg"
        testId="custom-game-content"
        dataSet={{
          component: 'CustomGameContent',
          phase: props.phase,
          place: props.place.screen,
        }}
      >
        <FrameNoticesView connection={props.connection} error={props.error} />
        {props.children}
        <Show when={props.back}>
          {(back) => (
            <GameActions sizing="fill">
              <Button
                title={back()}
                variant="outline"
                intent="neutral"
                onClick={() => props.onClose?.()}
                dataSet={{ testid: 'custom-game-place-back' }}
              />
            </GameActions>
          )}
        </Show>
        <FrameStatusView status={props.status} spokenOnly />
      </StackVertical>
    </EmbeddedScreen>
  );
}
