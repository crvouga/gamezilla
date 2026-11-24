import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import type {
  StageOverlay,
  StageOverlayEvent,
} from '@pkgs/turn-game-client-ts/stage-overlay';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameActionBar } from '@pkgs/ui-root-client-ts/game-action-bar';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import { type JSX, Show } from 'solid-js';
import type { MultiplayerBoardSlot } from './matchmaking-screen-view';
import type {
  MultiplayerGameCommands,
  MultiplayerGameView,
} from './multiplayer-game-view';
import { MultiplayerMoveList } from './multiplayer-move-list';
import {
  MultiplayerOverlayView,
  MultiplayerResultCard,
  type MultiplayerResultShown,
} from './multiplayer-overlay-view';
import {
  type MultiplayerPlaceFrame,
  MultiplayerStagePlace,
} from './multiplayer-place-frame';
import type { MultiplayerPlace } from './multiplayer-places';

type ResultProps = MultiplayerPlaceFrame & {
  readonly title: string;
  /** The seats around the board on the final position. */
  readonly board: MultiplayerBoardSlot | undefined;
  /** What lies over the final board: the result card, or nothing once closed. */
  readonly overlay: StageOverlay;
  readonly onOverlay: (event: StageOverlayEvent) => void;
  /** How the game ended, why, and the rating change: the screen's announcement. */
  readonly result: MultiplayerResultShown | undefined;
  readonly game: MultiplayerGameView;
  readonly commands: MultiplayerGameCommands;
  /** Rematch commands need a connection. */
  readonly online: boolean;
  readonly onOpen: (place: MultiplayerPlace) => void;
};

// Each label is short for the eye. A listener, who cannot see which game the
// row belongs to, also hears the rest of the sentence.

/** A rematch to offer, or one offered to the person to answer. */
function Rematch(props: ResultProps): JSX.Element {
  return (
    <Show
      when={props.game.rematch === 'answer'}
      fallback={
        <Show when={props.game.rematch === 'offer'}>
          <GameActionButton
            operation={props.commands.offerRematch}
            disabled={!props.online}
            title={
              <Trans>
                <VisuallyHidden>Offer a multiplayer </VisuallyHidden>Rematch
              </Trans>
            }
            successLabel={<Trans>Multiplayer rematch offered</Trans>}
            dataSet={{ testid: 'multiplayer-offer-rematch' }}
          />
        </Show>
      }
    >
      <GameActionButton
        operation={props.commands.acceptRematch}
        disabled={!props.online}
        variant="solid"
        title={
          <Trans>
            Accept<VisuallyHidden> the multiplayer</VisuallyHidden> rematch
          </Trans>
        }
        dataSet={{ testid: 'multiplayer-accept-rematch' }}
      />
      <GameActionButton
        operation={props.commands.declineRematch}
        disabled={!props.online}
        title={
          <Trans>
            Decline<VisuallyHidden> the multiplayer rematch</VisuallyHidden>
          </Trans>
        }
        dataSet={{ testid: 'multiplayer-decline-rematch' }}
      />
    </Show>
  );
}

/**
 * Seeking someone new. It is the screen's one filled command, unless a
 * rematch offered to the person waits for their answer.
 */
function NewOpponent(props: ResultProps): JSX.Element {
  const many = () => props.game.players > 2;
  return (
    <Show when={props.game.newOpponent}>
      <GameActionButton
        operation={props.commands.newOpponent}
        title={
          <Show
            when={many()}
            fallback={
              <Trans>
                <VisuallyHidden>Find a </VisuallyHidden>New opponent
              </Trans>
            }
          >
            <Trans>
              <VisuallyHidden>Find </VisuallyHidden>New players
            </Trans>
          </Show>
        }
        variant={props.game.rematch === 'answer' ? 'outline' : 'solid'}
        successLabel={
          <Show
            when={many()}
            fallback={<Trans>Opponent search accepted</Trans>}
          >
            <Trans>Player search accepted</Trans>
          </Show>
        }
        dataSet={{ testid: 'multiplayer-new-opponent' }}
      />
    </Show>
  );
}

/** Stepping through the finished game: its moves, or its record. */
function Review(props: ResultProps): JSX.Element {
  return (
    <Show when={props.game.moves !== null || props.game.record !== null}>
      <Button
        title={<Trans>Review</Trans>}
        aria-label={
          props.game.moves === null ? t`Game record` : t`Review moves`
        }
        variant="outline"
        intent="neutral"
        onClick={() => props.onOpen({ screen: 'moves' })}
        dataSet={{ testid: 'multiplayer-open-moves' }}
      />
    </Show>
  );
}

/**
 * Where else the result leads, on its card: a new game at another clock
 * and the person's ratings.
 */
function Onward(props: ResultProps): JSX.Element {
  return (
    <StackHorizontal gap="sm" wrap>
      <Show when={props.game.newOpponent}>
        <Button
          title={<Trans>Game options</Trans>}
          aria-label={t`New game: choose what to play for next`}
          variant="ghost"
          intent="neutral"
          size="sm"
          onClick={() => props.onOpen({ screen: 'home' })}
          dataSet={{ testid: 'multiplayer-open-find' }}
        />
      </Show>
      <Show when={props.game.newOpponent || props.game.rematch !== 'none'}>
        <Button
          title={<Trans>Your ratings</Trans>}
          variant="ghost"
          intent="neutral"
          size="sm"
          onClick={() => props.onOpen({ screen: 'ratings', from: 'result' })}
          dataSet={{ testid: 'multiplayer-open-ratings' }}
        />
      </Show>
    </StackHorizontal>
  );
}

/**
 * The matched game is over: the whole final position, held still, and
 * beside it (under it on a phone) a card that says how it ended and what
 * it did to the person's rating, with a new game at another clock and
 * their ratings one press away. Then one bar: a new opponent at the same
 * clock, a rematch, and the moves, which also sit beside a wide board.
 */
export function MultiplayerResultView(props: ResultProps): JSX.Element {
  return (
    <MultiplayerStagePlace {...props} title={props.title}>
      <GameSessionLayout
        notices={props.notices}
        boardFocus
        actionsBeside
        fixedStage
        // The card lies over the stage's foot (heading the rail beside a
        // wide board), so the final board keeps the live board's place.
        sheet={<MultiplayerResultCard result={props.result} />}
        // Other options and ratings come after the next game's commands.
        sheetFooter={<Onward {...props} />}
        actions={
          <GameActionBar aria-label={t`What next`} items={[]} width="content">
            <Show when={props.game.rematch === 'answer'}>
              <Rematch {...props} />
            </Show>
            <NewOpponent {...props} />
            <Show when={props.game.rematch !== 'answer'}>
              <Rematch {...props} />
            </Show>
            <Review {...props} />
          </GameActionBar>
        }
        aside={
          <Show when={props.game.moves}>
            {(moves) => (
              <GameSection title={<Trans>Moves</Trans>}>
                <MultiplayerMoveList
                  moves={moves()}
                  perTurn={props.game.players}
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
        {props.board?.(
          <MultiplayerOverlayView
            title={props.title}
            overlay={props.overlay}
            onOverlay={props.onOverlay}
            versus={undefined}
            result={props.result}
          />
        )}
      </GameSessionLayout>
    </MultiplayerStagePlace>
  );
}
