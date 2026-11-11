import { Plural, Trans } from '@lingui/solid/macro';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameActions } from '@pkgs/ui-root-client-ts/game-section';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import { type JSX, Show } from 'solid-js';
import type {
  MultiplayerGameCommands,
  MultiplayerGameView,
} from './multiplayer-game-view';
import {
  type MultiplayerPlaceFrame,
  MultiplayerStagePlace,
} from './multiplayer-place-frame';
import type { MultiplayerPlace } from './multiplayer-places';

type ResultProps = MultiplayerPlaceFrame & {
  readonly title: string;
  /** How the game ended, why, and the rating change: the screen's announcement. */
  readonly outcome: JSX.Element;
  /** The seats and the board on the final position. */
  readonly board: JSX.Element;
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

/** Where the finished game leads: its moves or record, and the person's ratings. */
function Onward(props: ResultProps): JSX.Element {
  return (
    <MenuSection>
      <Show when={props.game.moves}>
        {(moves) => (
          <MenuRow
            title={<Trans>Review moves</Trans>}
            value={
              <Plural
                value={moves().moves.length}
                one="# move"
                other="# moves"
              />
            }
            onClick={() => props.onOpen({ screen: 'moves' })}
            dataSet={{ testid: 'multiplayer-open-moves' }}
          />
        )}
      </Show>
      <Show when={props.game.moves === null && props.game.record !== null}>
        <MenuRow
          title={<Trans>Game record</Trans>}
          onClick={() => props.onOpen({ screen: 'moves' })}
          dataSet={{ testid: 'multiplayer-open-moves' }}
        />
      </Show>
      <MenuRow
        title={<Trans>Your ratings</Trans>}
        onClick={() => props.onOpen({ screen: 'ratings' })}
        dataSet={{ testid: 'multiplayer-open-ratings' }}
      />
    </MenuSection>
  );
}

/**
 * The matched game is over: how it ended and what it did to the person's
 * rating, a rematch or a new opponent, then the final position. Its moves
 * and the person's ratings are each one row away.
 */
export function MultiplayerResultView(props: ResultProps): JSX.Element {
  return (
    <MultiplayerStagePlace {...props} title={props.title}>
      <GameSessionLayout
        notices={props.notices}
        outcome={
          <StackVertical gap="md">
            {props.outcome}
            <GameActions>
              <Rematch {...props} />
              <NewOpponent {...props} />
            </GameActions>
          </StackVertical>
        }
        aside={<Onward {...props} />}
      >
        {props.board}
      </GameSessionLayout>
    </MultiplayerStagePlace>
  );
}
