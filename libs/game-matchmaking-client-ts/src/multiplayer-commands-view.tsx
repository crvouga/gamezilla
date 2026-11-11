import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Spinner } from '@pkgs/ui-root-client-ts/spinner';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import { createSignal, type JSX, Show } from 'solid-js';
import type {
  MultiplayerGameCommands,
  MultiplayerGameView,
} from './multiplayer-game-view';
import {
  MultiplayerMenuPlace,
  type MultiplayerPlaceFrame,
} from './multiplayer-place-frame';
import type { MultiplayerPlace } from './multiplayer-places';

type CommandsProps = MultiplayerPlaceFrame & {
  readonly game: MultiplayerGameView;
  readonly commands: MultiplayerGameCommands;
  readonly onOpen: (place: MultiplayerPlace) => void;
  /** Returns to the game. */
  readonly onBack: () => void;
};

/**
 * A command being sent: its row shows it and the others wait. Accepted, the
 * person is back on the game; refused, they stay here and the notice above
 * says why.
 */
function useSending(onAccepted: () => void) {
  const [sending, setSending] = createSignal(false);
  const send = (operation: () => Promise<void>): void => {
    if (sending()) return;
    setSending(true);
    void operation()
      .then(onAccepted, () => undefined)
      .finally(() => setSending(false));
  };
  return { sending, send };
}

// Each label is short for the eye. A listener, who cannot see which game the
// row belongs to, also hears the rest of the sentence.

/** Aborting before play begins, resigning after: either asks first. */
function LeaveRows(
  props: CommandsProps & { readonly busy: boolean }
): JSX.Element {
  return (
    <Show when={props.game.leave}>
      {(leave) => (
        <MenuSection>
          <Show
            when={leave() === 'resign'}
            fallback={
              <MenuRow
                title={
                  <Trans>
                    Abort<VisuallyHidden> the multiplayer game</VisuallyHidden>
                  </Trans>
                }
                caption={<Trans>No result and no rating change.</Trans>}
                tone="destructive"
                hideChevron
                disabled={props.busy}
                onClick={() => props.commands.ask('abort')}
                dataSet={{ testid: 'multiplayer-abort' }}
              />
            }
          >
            <MenuRow
              title={
                <Trans>
                  Resign<VisuallyHidden> multiplayer game</VisuallyHidden>
                </Trans>
              }
              tone="destructive"
              hideChevron
              disabled={props.busy}
              onClick={() => props.commands.ask('resign')}
              dataSet={{ testid: 'multiplayer-resign' }}
            />
          </Show>
        </MenuSection>
      )}
    </Show>
  );
}

/** What changes only this device's view of the game. */
function BoardRows(
  props: CommandsProps & { readonly busy: boolean }
): JSX.Element {
  return (
    <>
      <Show when={props.game.flip}>
        {(flip) => (
          <MenuRow
            title={<Trans>Flip board</Trans>}
            value={
              <Show when={flip().flipped} fallback={<Trans>Your side</Trans>}>
                <Trans>Other side</Trans>
              </Show>
            }
            hideChevron
            disabled={props.busy}
            onClick={() => {
              props.commands.flip();
              props.onBack();
            }}
            dataSet={{ testid: 'multiplayer-flip-board' }}
          />
        )}
      </Show>
      <Show when={props.stage === 'playing' && props.game.moves}>
        {(moves) => (
          <MenuRow
            title={<Trans>Review moves</Trans>}
            value={moves().moves.length}
            disabled={props.busy}
            onClick={() => props.onOpen({ screen: 'moves' })}
            dataSet={{ testid: 'multiplayer-open-moves' }}
          />
        )}
      </Show>
    </>
  );
}

/**
 * The matched game's commands, one row each: offering a draw, turning the
 * board around, stepping through the moves, then, apart, the one that ends
 * the game. A row that sends a command shows it going and returns to the
 * game once it is accepted.
 */
export function MultiplayerCommandsView(props: CommandsProps): JSX.Element {
  const draw = useSending(() => props.onBack());
  const reviewable = () =>
    props.stage === 'playing' && props.game.moves !== null;
  return (
    <MultiplayerMenuPlace {...props} title={<Trans>Game menu</Trans>}>
      <Show
        when={
          props.game.draw === 'offer' ||
          props.game.flip !== null ||
          reviewable()
        }
      >
        <MenuSection>
          <Show when={props.game.draw === 'offer'}>
            <MenuRow
              title={
                <Trans>
                  Offer a<VisuallyHidden> multiplayer</VisuallyHidden> draw
                </Trans>
              }
              trailing={
                draw.sending() ? (
                  <Spinner size="sm" label={t`Sending`} />
                ) : undefined
              }
              hideChevron
              disabled={draw.sending()}
              onClick={() => draw.send(props.commands.offerDraw)}
              dataSet={{ testid: 'multiplayer-offer-draw' }}
            />
          </Show>
          <BoardRows {...props} busy={draw.sending()} />
        </MenuSection>
      </Show>
      <LeaveRows {...props} busy={draw.sending()} />
    </MultiplayerMenuPlace>
  );
}
