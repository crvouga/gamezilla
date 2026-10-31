import { UserUsername } from '@libs/profile-client-ts/user-username';
import { Trans } from '@lingui/solid/macro';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';
import type { CustomGameScreenModel } from './use-custom-game-screen';

/** The other participant, when they are a person who is away right now. */
function awayOpponent(model: CustomGameScreenModel): string | null {
  const game = model.current();
  const side = model.mySide();
  if (game === null || side === null) return null;
  const other = game.sides
    .filter((candidate) => candidate !== side)
    .map((candidate) => game[candidate])
    .find(
      (participant) =>
        participant.kind === 'person' &&
        model.awaySince(participant.person) !== null
    );
  return other?.person ?? null;
}

function CustomGameAway(props: { model: CustomGameScreenModel }): JSX.Element {
  return (
    <Show when={props.model.sharedAvailable() && awayOpponent(props.model)}>
      {(person) => (
        <StackVertical gap="md" testId="custom-game-away">
          <Notice>
            <Text variant="inherit" role="status">
              <UserUsername profileId={person()} withAt={false} />{' '}
              <Show
                when={props.model.current()?.sides.length === 2}
                fallback={
                  <Trans>
                    is away. Their turn stays reserved until they return.
                  </Trans>
                }
              >
                <Trans>
                  is away. After a minute away you may claim the win.
                </Trans>
              </Show>
            </Text>
          </Notice>
        </StackVertical>
      )}
    </Show>
  );
}

/**
 * Claiming the win from an opponent who stays away, in the game's action
 * row beside the other commands; the notice above the board says why.
 */
export function CustomGameClaimWin(props: {
  model: CustomGameScreenModel;
}): JSX.Element {
  return (
    <Show
      when={
        props.model.sharedAvailable() &&
        awayOpponent(props.model) !== null &&
        props.model.canPlay() &&
        props.model.current()?.sides.length === 2
      }
    >
      <GameActionButton
        title={<Trans>Claim the win</Trans>}
        variant="solid"
        dataSet={{ testid: 'custom-game-claim-win' }}
        operation={() => props.model.choose({ operation: 'claimWin' })}
      />
    </Show>
  );
}

type ActiveProps = { model: CustomGameScreenModel };

const drawOffer = (model: CustomGameScreenModel): string =>
  model.current()?.drawOfferedBy ?? '';
const allPeople = (model: CustomGameScreenModel): boolean => {
  const game = model.current();
  return (
    game !== null && game.sides.every((side) => game[side].kind === 'person')
  );
};
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
          <Text variant="inherit" role="status">
            <Trans>A draw has been offered.</Trans>
          </Text>
        </Notice>
      </Show>
      <CustomGameAway model={props.model} />
      <Show
        when={
          playing(props.model) &&
          allPeople(props.model) &&
          drawOffer(props.model) === '' &&
          declinedDraw(props.model)
        }
      >
        <P variant="caption" tone="secondary">
          <Trans>You may offer a draw again after your next move.</Trans>
        </P>
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
          allPeople(props.model) && offer() === '' && !declinedDraw(props.model)
        }
      >
        <GameActionButton
          title={<Trans>Offer draw</Trans>}
          dataSet={{ testid: 'custom-game-offer' }}
          operation={() => props.model.choose({ operation: 'offer' })}
        />
      </Show>
      <Show
        when={
          offer() !== '' &&
          offer() !== props.model.myId() &&
          !props.model.current()?.drawAcceptedBy.includes(props.model.myId())
        }
      >
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
