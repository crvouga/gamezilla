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
import { Grid, type GridColumns } from '@pkgs/ui-root-client-ts/grid';
import { ChevronUpIcon } from '@pkgs/ui-root-client-ts/icons';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import { type JSX, Show } from 'solid-js';
import type {
  MultiplayerGameCommands,
  MultiplayerGameView,
} from './multiplayer-game-view';
import { MultiplayerMoveList } from './multiplayer-move-list';
import {
  MultiplayerOverlayView,
  type MultiplayerResultShown,
} from './multiplayer-overlay-view';
import {
  type MultiplayerPlaceFrame,
  MultiplayerStagePlace,
} from './multiplayer-place-frame';
import type { MultiplayerPlace } from './multiplayer-places';
import type { MultiplayerBoardSlot } from './multiplayer-screen-view';

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
function Rematch(
  props: ResultProps & { readonly fullWidth?: boolean | undefined }
): JSX.Element {
  return (
    <Show
      when={props.game.rematch === 'answer'}
      fallback={
        <Show when={props.game.rematch === 'offer'}>
          <GameActionButton
            operation={props.commands.offerRematch}
            disabled={!props.online}
            fullWidth={props.fullWidth === true}
            title={
              <Trans>
                <VisuallyHidden>Offer a multiplayer </VisuallyHidden>Rematch
              </Trans>
            }
            successLabel={
              <Trans>
                <VisuallyHidden>Rematch </VisuallyHidden>Offered
              </Trans>
            }
            dataSet={{ testid: 'multiplayer-offer-rematch' }}
          />
        </Show>
      }
    >
      <GameActionButton
        operation={props.commands.acceptRematch}
        disabled={!props.online}
        fullWidth={props.fullWidth === true}
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
        fullWidth={props.fullWidth === true}
        variant="outline"
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
function NewOpponent(
  props: ResultProps & { readonly fullWidth?: boolean | undefined }
): JSX.Element {
  const many = () => props.game.players > 2;
  return (
    <Show when={props.game.newOpponent}>
      <GameActionButton
        fullWidth={props.fullWidth === true}
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

/** The finished game has moves or a record to step through. */
const hasReview = (props: ResultProps): boolean =>
  props.game.moves !== null || props.game.record !== null;

/** Stepping through the finished game: its moves, or its record. */
function Review(
  props: ResultProps & { readonly fullWidth?: boolean | undefined }
): JSX.Element {
  return (
    <Show when={hasReview(props)}>
      <Button
        fullWidth={props.fullWidth === true}
        title={
          <Show
            when={props.fullWidth === true}
            fallback={<Trans>Review</Trans>}
          >
            <Trans>Moves</Trans>
          </Show>
        }
        aria-label={
          props.game.moves === null
            ? props.fullWidth === true
              ? t`Record: the game record`
              : t`Game record`
            : props.fullWidth === true
              ? t`Review the moves`
              : t`Review moves`
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
 * Looking back and elsewhere, on the card's second row: the moves, a new
 * game at another clock and the person's ratings.
 */
function Onward(props: ResultProps): JSX.Element {
  // One even row, as many columns as it has steps.
  const columns = (): GridColumns =>
    ((hasReview(props) ? 1 : 0) +
      (props.game.newOpponent ? 1 : 0) +
      1) as GridColumns;
  return (
    <Grid columns={columns()} gap="sm" width="full">
      <Review {...props} fullWidth />
      <Show when={props.game.newOpponent}>
        <Button
          title={<Trans>New clock</Trans>}
          aria-label={t`New clock: find an opponent at another clock`}
          variant="outline"
          intent="neutral"
          fullWidth
          onClick={() => props.onOpen({ screen: 'find' })}
          dataSet={{ testid: 'multiplayer-open-find' }}
        />
      </Show>
      <Button
        title={<Trans>Ratings</Trans>}
        aria-label={t`Ratings: yours, for every speed`}
        variant="outline"
        intent="neutral"
        fullWidth
        onClick={() => props.onOpen({ screen: 'ratings', from: 'result' })}
        dataSet={{ testid: 'multiplayer-open-ratings' }}
      />
    </Grid>
  );
}

/** The closed result card's way back, saying how the game ended. */
function ShowResult(props: ResultProps): JSX.Element {
  return (
    <Show when={props.overlay.kind === 'board' ? props.result : undefined}>
      {(result) => (
        <StackVertical testId="multiplayer-announcement">
          <Button
            title={result().title}
            variant="ghost"
            intent="neutral"
            fullWidth
            endIcon={<ChevronUpIcon size={20} />}
            onClick={() => props.onOverlay({ type: 'show' })}
            dataSet={{ testid: 'multiplayer-show-result' }}
          />
        </StackVertical>
      )}
    </Show>
  );
}

/**
 * The matched game is over: the final position, held still, under a card
 * that says how it ended and what it did to the person's rating, with a
 * new game at another clock and their ratings one press away. Under the
 * board, one bar: a new opponent at the same clock, a rematch, and the
 * moves, which also sit beside a wide board. Closing the card shows the final board; the line under it brings
 * the card back.
 */
/** What to play next: answer a rematch, a new opponent, a rematch. */
function NextSteps(props: ResultProps): JSX.Element {
  return (
    <>
      <Show when={props.game.rematch === 'answer'}>
        <Rematch {...props} />
      </Show>
      <NewOpponent {...props} />
      <Show when={props.game.rematch !== 'answer'}>
        <Rematch {...props} />
      </Show>
    </>
  );
}

/**
 * The card's steps on even rows: answering a rematch offered to the person
 * (Accept, Decline) over a full-width new opponent, or a new opponent
 * beside offering a rematch; then the look-back row.
 */
function CardSteps(props: ResultProps): JSX.Element {
  const playing = (): GridColumns =>
    ((props.game.newOpponent ? 1 : 0) +
      (props.game.rematch === 'offer' ? 1 : 0) || 1) as GridColumns;
  return (
    <StackVertical gap="sm" width="full">
      <Show
        when={props.game.rematch === 'answer'}
        fallback={
          <Show when={props.game.newOpponent || props.game.rematch === 'offer'}>
            <Grid columns={playing()} gap="sm" width="full">
              <NewOpponent {...props} fullWidth />
              <Rematch {...props} fullWidth />
            </Grid>
          </Show>
        }
      >
        <Grid columns={2} gap="sm" width="full">
          <Rematch {...props} fullWidth />
        </Grid>
        <NewOpponent {...props} fullWidth />
      </Show>
      <Onward {...props} />
    </StackVertical>
  );
}

export function MultiplayerResultView(props: ResultProps): JSX.Element {
  // While the result card is open it holds every next step itself (it holds
  // the keyboard too); closed, the same steps stand under the board.
  const cardOpen = () =>
    props.overlay.kind === 'outcome' && props.result !== undefined;
  return (
    <MultiplayerStagePlace {...props} title={props.title}>
      <GameSessionLayout
        notices={props.notices}
        boardFocus
        actionsBeside
        fixedStage
        status={<ShowResult {...props} />}
        actions={
          <Show when={!cardOpen()}>
            <GameActionBar aria-label={t`What next`} items={[]} width="content">
              <NextSteps {...props} />
              <Review {...props} />
            </GameActionBar>
          </Show>
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
            actions={<CardSteps {...props} />}
          />
        )}
      </GameSessionLayout>
    </MultiplayerStagePlace>
  );
}
