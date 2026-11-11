import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameActionBar } from '@pkgs/ui-root-client-ts/game-action-bar';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import { MenuIcon } from '@pkgs/ui-root-client-ts/icons';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import { type JSX, Show } from 'solid-js';
import type {
  MultiplayerGameCommands,
  MultiplayerGameView,
} from './multiplayer-game-view';
import { MultiplayerMoveList } from './multiplayer-move-list';
import {
  type MultiplayerPlaceFrame,
  MultiplayerStagePlace,
} from './multiplayer-place-frame';
import type { MultiplayerPlace, MultiplayerStage } from './multiplayer-places';

type PlayProps = MultiplayerPlaceFrame & {
  readonly title: string;
  /** The seats around the board on the live position, under its overlay. */
  readonly board: JSX.Element;
  /** The line that says whose turn it is. */
  readonly status: JSX.Element;
  readonly game: MultiplayerGameView;
  readonly commands: MultiplayerGameCommands;
  readonly onOpen: (place: MultiplayerPlace) => void;
};

/**
 * Whether the game's commands have anything to offer this person. The
 * moves are stepped through only once play has begun.
 */
export function multiplayerHasCommands(
  game: MultiplayerGameView,
  stage: MultiplayerStage
): boolean {
  return (
    game.leave !== null ||
    game.draw === 'offer' ||
    game.flip !== null ||
    (stage === 'playing' && game.moves !== null)
  );
}

/** The one way to the game's commands, where there are any. */
export function MultiplayerCommandsControl(props: {
  readonly game: MultiplayerGameView;
  readonly stage: MultiplayerStage;
  readonly onOpen: (place: MultiplayerPlace) => void;
}): JSX.Element {
  return (
    <Show when={multiplayerHasCommands(props.game, props.stage)}>
      <Button
        title={<Trans>Menu</Trans>}
        aria-label={t`Game menu`}
        variant="outline"
        intent="neutral"
        startIcon={<MenuIcon size={20} />}
        onClick={() => props.onOpen({ screen: 'commands' })}
        dataSet={{ testid: 'multiplayer-open-commands' }}
      />
    </Show>
  );
}

// Each label is short for the eye. A listener, who cannot see which game the
// row belongs to, also hears the rest of the sentence.

/** A draw offered to the person waits for their answer, right under the board. */
function DrawAnswer(props: PlayProps): JSX.Element {
  return (
    <Show when={props.game.draw === 'answer'}>
      <GameActionButton
        operation={props.commands.acceptDraw}
        variant="solid"
        title={
          <Trans>
            Accept<VisuallyHidden> the multiplayer</VisuallyHidden> draw
          </Trans>
        }
        dataSet={{ testid: 'multiplayer-accept-draw' }}
      />
      <GameActionButton
        operation={props.commands.declineDraw}
        title={
          <Trans>
            Decline<VisuallyHidden> the multiplayer draw</VisuallyHidden>
          </Trans>
        }
        dataSet={{ testid: 'multiplayer-decline-draw' }}
      />
    </Show>
  );
}

/**
 * The two commands a player reaches for mid-game, one press from the
 * board: offering a draw, and leaving (resigning, or aborting before play
 * begins), which asks first.
 */
function QuickCommands(props: PlayProps): JSX.Element {
  return (
    <>
      <Show when={props.game.draw === 'offer'}>
        <GameActionButton
          operation={props.commands.offerDraw}
          title={
            <Trans>
              Offer<VisuallyHidden> a multiplayer</VisuallyHidden> draw
            </Trans>
          }
          successLabel={<Trans>Multiplayer draw offered</Trans>}
          dataSet={{ testid: 'multiplayer-offer-draw-now' }}
        />
      </Show>
      <Show when={props.game.leave}>
        {(leave) => (
          <Button
            title={
              <Show
                when={leave() === 'abort'}
                fallback={
                  <Trans>
                    Resign<VisuallyHidden> the multiplayer game</VisuallyHidden>
                  </Trans>
                }
              >
                <Trans>
                  Abort<VisuallyHidden> the multiplayer game</VisuallyHidden>
                </Trans>
              </Show>
            }
            variant="outline"
            intent="neutral"
            onClick={() => props.commands.ask(leave())}
            dataSet={{ testid: 'multiplayer-leave-now', leave: leave() }}
          />
        )}
      </Show>
    </>
  );
}

/**
 * The matched game in play, on the live position, as one view a phone
 * never scrolls: the seats around the board, and under it the line that
 * says whose turn it is and one bar of commands: an offered draw's answer,
 * offering a draw, resigning (confirmed) and the game's menu, where the
 * rest waits. The moves played sit beside a wide board; choosing one opens
 * the moves, on that position. A game found on this device opens under
 * the versus card (the board's overlay).
 */
export function MultiplayerPlayView(props: PlayProps): JSX.Element {
  return (
    <MultiplayerStagePlace {...props} title={props.title}>
      <GameSessionLayout
        notices={props.notices}
        boardFocus
        actionsBeside
        fixedStage
        status={props.status}
        actions={
          <GameActionBar
            aria-label={t`Game actions`}
            items={[]}
            width="content"
          >
            <DrawAnswer {...props} />
            <QuickCommands {...props} />
            <MultiplayerCommandsControl
              game={props.game}
              stage={props.stage}
              onOpen={props.onOpen}
            />
          </GameActionBar>
        }
        aside={
          <Show when={props.game.moves}>
            {(moves) => (
              <GameSection title={<Trans>Moves</Trans>}>
                <MultiplayerMoveList
                  moves={moves()}
                  onChoose={(ply) => {
                    props.commands.chooseMove(ply);
                    props.onOpen({ screen: 'moves' });
                  }}
                />
              </GameSection>
            )}
          </Show>
        }
      >
        {props.board}
      </GameSessionLayout>
    </MultiplayerStagePlace>
  );
}
