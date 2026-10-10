import type { MultiplayerGame } from '@libs/chess-matchmaking-shared/game-state';
import { bothHaveMoved } from '@libs/chess-matchmaking-shared/game-state';
import { multiplayerDeadlineMs } from '@libs/chess-matchmaking-shared/multiplayer-clock';
import { AccountAutomationLabel } from '@libs/profile-client/account-automation-label';
import { UserProfileAvatar } from '@libs/profile-client/user-profile-avatar';
import { UserUsername } from '@libs/profile-client/user-username';
import { Trans } from '@lingui/solid/macro';
import { GameCountdown } from '@pkgs/ui-root-client/game-countdown';
import { GamePlayerCard } from '@pkgs/ui-root-client/game-player-card';
import { GameVersus } from '@pkgs/ui-root-client/game-versus';
import { type JSX, Show } from 'solid-js';
import { useOfflineSince } from './use-offline-since';

export function MultiplayerLineup(props: {
  game: MultiplayerGame;
  myId: string;
  opponentName: string;
  opponentRating: string;
  white: boolean;
  participant: boolean;
}): JSX.Element {
  const ownId = () => (props.white ? props.game.white_id : props.game.black_id);
  const otherId = () =>
    props.white ? props.game.black_id : props.game.white_id;
  const offlineSince = useOfflineSince();
  return (
    <>
      <GameVersus
        first={
          <GamePlayerCard
            label={
              <Show when={props.white} fallback={<Trans>Black</Trans>}>
                <Trans>White</Trans>
              </Show>
            }
            name={<UserUsername profileId={ownId()} withAt={false} />}
            avatar={<UserProfileAvatar profileId={ownId()} size={48} />}
            active={
              props.game.outcome === 'ongoing' && props.game.turn === ownId()
            }
            status={
              <span data-testid="multiplayer-colour">
                <Show
                  when={props.participant}
                  fallback={<Trans>Watching multiplayer chess.</Trans>}
                >
                  <Show
                    when={props.white}
                    fallback={<Trans>You play Black</Trans>}
                  >
                    <Trans>You play White</Trans>
                  </Show>
                </Show>
              </span>
            }
          />
        }
        second={
          <GamePlayerCard
            label={
              <Show when={props.white} fallback={<Trans>White</Trans>}>
                <Trans>Black</Trans>
              </Show>
            }
            name={
              <span data-testid="multiplayer-opponent">
                {props.opponentName} ({props.opponentRating})
                <AccountAutomationLabel profileId={otherId()} />
              </span>
            }
            avatar={<UserProfileAvatar profileId={otherId()} size={48} />}
            active={
              props.game.outcome === 'ongoing' && props.game.turn === otherId()
            }
            status={
              <span data-testid="multiplayer-time-control">
                {props.game.time_control ?? ''}
              </span>
            }
          />
        }
      />
      <Show
        when={props.game.outcome === 'ongoing' && !bothHaveMoved(props.game)}
      >
        <GameCountdown
          deadline={multiplayerDeadlineMs(props.game)}
          pausedAt={offlineSince()}
          label={
            <Show
              when={props.game.turn === props.myId}
              fallback={<Trans>Waiting for the first move</Trans>}
            >
              <Trans>Make your first move</Trans>
            </Show>
          }
          dataSet={{ testid: 'multiplayer-first-move-countdown' }}
        />
      </Show>
    </>
  );
}
