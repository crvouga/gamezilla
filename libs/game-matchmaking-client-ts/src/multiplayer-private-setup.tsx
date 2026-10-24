import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import { awaitingSetups } from '@libs/game-matchmaking-shared-ts/game-state';
import { Trans } from '@lingui/solid/macro';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { useGamePresentation } from '@pkgs/turn-game-client-ts/turn-games-context';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameActions, GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { For, type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { MultiplayerPrivateSetup } from './use-multiplayer-private-setup';

const SIDES = ['white', 'black'] as const;

/**
 * While a matched game waits for private setups: the person's own setup
 * board until they choose it (once, for good), whether it is complete, and
 * who is ready, which the other person and every watcher see too.
 */
export function MultiplayerPrivateSetupPanel(props: {
  readonly game: MultiplayerGame;
  readonly setup: MultiplayerPrivateSetup;
  readonly onChoose: (setup: string) => Promise<void>;
}): JSX.Element {
  const presentation = useGamePresentation();
  // With no connection the setup holds still: the game may have moved on.
  const sync = useSyncEngine();
  const offline = () => !sync.status().online;
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
                locked={offline()}
                onChange={(next: string) => props.setup.arrange(next)}
                testId="multiplayer-setup"
              />
            )}
          </Show>
          <GameActions>
            <GameActionButton
              title={<Trans>Random setup</Trans>}
              dataSet={{ testid: 'multiplayer-setup-random' }}
              disabled={offline()}
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
        <P
          variant="bodyBold"
          role="status"
          dataSet={{ testid: 'multiplayer-setup-status' }}
        >
          <Show
            when={props.setup.side() !== null}
            fallback={
              <Trans>The players are choosing their private setups.</Trans>
            }
          >
            <Show
              when={props.setup.ready(side())}
              fallback={
                <Show
                  when={props.setup.complete()}
                  fallback={<Trans>Your private setup is incomplete.</Trans>}
                >
                  <Trans>Your private setup is complete.</Trans>
                </Show>
              }
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
        </P>
        <MultiplayerSetupReadiness game={props.game} setup={props.setup} />
      </GameSection>
    </Show>
  );
}

function MultiplayerSetupReadiness(props: {
  readonly game: MultiplayerGame;
  readonly setup: MultiplayerPrivateSetup;
}): JSX.Element {
  const presentation = useGamePresentation();
  return (
    <StackHorizontal
      wrap
      align="center"
      gap="sm"
      role="list"
      dataSet={{ testid: 'multiplayer-setup-readiness' }}
    >
      <For each={SIDES}>
        {(which) => (
          <StackHorizontal
            align="center"
            gap="xs"
            role="listitem"
            dataSet={{ testid: `multiplayer-setup-readiness-${which}` }}
          >
            <Badge
              intent="neutral"
              label={presentation(props.game.fen).sideLabel(which)}
            />
            <Show
              when={props.setup.ready(which)}
              fallback={
                <Badge intent="neutral" label={<Trans>Getting ready</Trans>} />
              }
            >
              <Badge intent="success" label={<Trans>Ready</Trans>} />
            </Show>
          </StackHorizontal>
        )}
      </For>
    </StackHorizontal>
  );
}
