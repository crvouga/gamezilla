import type { MultiplayerGame } from '@libs/game-matchmaking-shared/game-state';
import { awaitingSetups } from '@libs/game-matchmaking-shared/game-state';
import { Trans } from '@lingui/solid/macro';
import { useGamePresentation } from '@pkgs/turn-game-client/turn-games-context';
import { GameActionButton } from '@pkgs/ui-root-client/game-action-button';
import { GameActions, GameSection } from '@pkgs/ui-root-client/game-section';
import { type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { MultiplayerPrivateSetup } from './use-multiplayer-private-setup';

/**
 * While a matched game waits for private setups: the person's own setup
 * board until they choose it (once, for good), and who is ready.
 */
export function MultiplayerPrivateSetupPanel(props: {
  readonly game: MultiplayerGame;
  readonly setup: MultiplayerPrivateSetup;
  readonly onChoose: (setup: string) => Promise<void>;
}): JSX.Element {
  const presentation = useGamePresentation();
  const side = () => props.setup.side() ?? 'white';
  const other = () => (side() === 'white' ? 'black' : 'white');
  return (
    <Show when={props.setup.has() && awaitingSetups(props.game)}>
      <GameSection
        title={<Trans>Private setups</Trans>}
        description={
          <Trans>
            Each side chooses a private setup before the first move.
          </Trans>
        }
      >
        <Show when={props.setup.choosing()}>
          <Show when={presentation(props.game.fen).SetupBoard}>
            {(Board) => (
              <Dynamic
                component={Board()}
                setup={props.setup.draft()}
                side={side()}
                locked={false}
                onChange={(next: string) => props.setup.arrange(next)}
                testId="multiplayer-setup"
              />
            )}
          </Show>
          <GameActions>
            <GameActionButton
              title={<Trans>Random setup</Trans>}
              dataSet={{ testid: 'multiplayer-setup-random' }}
              operation={async () => props.setup.random()}
            />
            <GameActionButton
              title={<Trans>Choose this setup</Trans>}
              variant="solid"
              dataSet={{ testid: 'multiplayer-setup-choose' }}
              disabled={!props.setup.complete()}
              operation={() => props.onChoose(props.setup.draft())}
            />
          </GameActions>
        </Show>
        <p
          class="text textBodyBold"
          role="status"
          data-testid="multiplayer-setup-status"
        >
          <Show
            when={props.setup.side() !== null}
            fallback={
              <Trans>The players are choosing their private setups.</Trans>
            }
          >
            <Show
              when={props.setup.ready(side())}
              fallback={<Trans>Choose your private setup.</Trans>}
            >
              <Show
                when={props.setup.ready(other())}
                fallback={
                  <Trans>You are ready. Waiting for the other player.</Trans>
                }
              >
                <Trans>Both players are ready.</Trans>
              </Show>
            </Show>
          </Show>
        </p>
      </GameSection>
    </Show>
  );
}
