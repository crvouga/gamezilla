import { otherCustomGameSide } from '@libs/chess-custom-game-shared/custom-game-state';
import { UserUsername } from '@libs/profile-client/user-username';
import { Trans } from '@lingui/solid/macro';
import { GameActionButton } from '@pkgs/ui-root-client/game-action-button';
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
    <Show when={awayOpponent(props.model)}>
      {(person) => (
        <div class="box gap-2" data-testid="chess-custom-away">
          <p role="status">
            <UserUsername profileId={person()} withAt={false} />{' '}
            <Trans>is away. After a minute away you may claim the win.</Trans>
          </p>
          <Show when={props.model.canPlay()}>
            <GameActionButton
              title={<Trans>Claim the win</Trans>}
              dataSet={{ testid: 'chess-custom-claim-win' }}
              operation={() => props.model.choose({ operation: 'claimWin' })}
            />
          </Show>
        </div>
      )}
    </Show>
  );
}

export function CustomGameActive(props: {
  model: CustomGameScreenModel;
}): JSX.Element {
  const offer = (): string => props.model.current()?.drawOfferedBy ?? '';
  const twoPeople = (): boolean =>
    props.model.current()?.white.kind === 'person' &&
    props.model.current()?.black.kind === 'person';
  const declined = (): boolean =>
    props.model.current()?.declinedOffers.includes(props.model.myId()) === true;
  return (
    <div class="box gap-3">
      <Show when={offer() !== ''}>
        <p role="status">
          <Trans>A draw has been offered.</Trans>
        </p>
      </Show>
      <CustomGameAway model={props.model} />
      <Show when={props.model.mySide() !== null && props.model.canPlay()}>
        <div class="box flex-row gap-2 flex-wrap">
          <Show when={twoPeople() && offer() === '' && declined()}>
            <p>
              <Trans>You may offer a draw again after your next move.</Trans>
            </p>
          </Show>
          <Show when={twoPeople() && offer() === '' && !declined()}>
            <GameActionButton
              title={<Trans>Offer draw</Trans>}
              dataSet={{ testid: 'chess-custom-offer' }}
              operation={() => props.model.choose({ operation: 'offer' })}
            />
          </Show>
          <Show when={offer() !== '' && offer() !== props.model.myId()}>
            <GameActionButton
              title={<Trans>Agree draw</Trans>}
              dataSet={{ testid: 'chess-custom-agree' }}
              operation={() => props.model.choose({ operation: 'agree' })}
            />
            <GameActionButton
              title={<Trans>Decline draw</Trans>}
              dataSet={{ testid: 'chess-custom-reject' }}
              operation={() => props.model.choose({ operation: 'reject' })}
            />
          </Show>
        </div>
      </Show>
    </div>
  );
}
