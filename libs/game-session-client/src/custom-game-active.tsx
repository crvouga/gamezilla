import { otherCustomGameSide } from '@libs/game-session-shared/custom-game-state';
import { UserUsername } from '@libs/profile-client/user-username';
import { Trans } from '@lingui/solid/macro';
import { GameActionButton } from '@pkgs/ui-root-client/game-action-button';
import { Notice } from '@pkgs/ui-root-client/notice';
import { type JSX, Show } from 'solid-js';
import type { CustomGameScreenModel } from './use-custom-game-screen';

/** The other participant, when they are a person who is away right now. */
function awayOpponent(model: CustomGameScreenModel): string | null {
  const game = model.current();
  const side = model.mySide();
  if (game === null || side === null) return null;
  const other = game[otherCustomGameSide(side)];
  return other.kind === 'person' && model.awaySince(other.person) !== null
    ? other.person
    : null;
}

function CustomGameAway(props: { model: CustomGameScreenModel }): JSX.Element {
  return (
    <Show when={props.model.sharedAvailable() && awayOpponent(props.model)}>
      {(person) => (
        <div class="box gap-3" data-testid="custom-game-away">
          <Notice>
            <span role="status">
              <UserUsername profileId={person()} withAt={false} />{' '}
              <Trans>is away. After a minute away you may claim the win.</Trans>
            </span>
          </Notice>
          <Show when={props.model.canPlay()}>
            <GameActionButton
              title={<Trans>Claim the win</Trans>}
              variant="solid"
              dataSet={{ testid: 'custom-game-claim-win' }}
              operation={() => props.model.choose({ operation: 'claimWin' })}
            />
          </Show>
        </div>
      )}
    </Show>
  );
}

type ActiveProps = { model: CustomGameScreenModel };

const drawOffer = (model: CustomGameScreenModel): string =>
  model.current()?.drawOfferedBy ?? '';
const twoPeople = (model: CustomGameScreenModel): boolean =>
  model.current()?.white.kind === 'person' &&
  model.current()?.black.kind === 'person';
const declinedDraw = (model: CustomGameScreenModel): boolean =>
  model.current()?.declinedOffers.includes(model.myId()) === true;
const playing = (model: CustomGameScreenModel): boolean =>
  model.mySide() !== null && model.canPlay();

/** What a participant is told during play: a draw offer, an absent opponent. */
export function CustomGameActiveNotices(props: ActiveProps): JSX.Element {
  return (
    <>
      <Show when={drawOffer(props.model) !== ''}>
        <Notice>
          <span role="status">
            <Trans>A draw has been offered.</Trans>
          </span>
        </Notice>
      </Show>
      <CustomGameAway model={props.model} />
      <Show
        when={
          playing(props.model) &&
          twoPeople(props.model) &&
          drawOffer(props.model) === '' &&
          declinedDraw(props.model)
        }
      >
        <p class="text textCaption">
          <Trans>You may offer a draw again after your next move.</Trans>
        </p>
      </Show>
    </>
  );
}

/** The draw choices a participant has right now, for the game's action row. */
export function CustomGameDrawActions(props: ActiveProps): JSX.Element {
  const offer = () => drawOffer(props.model);
  return (
    <Show when={playing(props.model)}>
      <Show
        when={
          twoPeople(props.model) && offer() === '' && !declinedDraw(props.model)
        }
      >
        <GameActionButton
          title={<Trans>Offer draw</Trans>}
          dataSet={{ testid: 'custom-game-offer' }}
          operation={() => props.model.choose({ operation: 'offer' })}
        />
      </Show>
      <Show when={offer() !== '' && offer() !== props.model.myId()}>
        <GameActionButton
          title={<Trans>Agree draw</Trans>}
          variant="solid"
          dataSet={{ testid: 'custom-game-agree' }}
          operation={() => props.model.choose({ operation: 'agree' })}
        />
        <GameActionButton
          title={<Trans>Decline draw</Trans>}
          dataSet={{ testid: 'custom-game-reject' }}
          operation={() => props.model.choose({ operation: 'reject' })}
        />
      </Show>
    </Show>
  );
}
