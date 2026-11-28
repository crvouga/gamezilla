import { GameSetupMode } from '@libs/spaces-client-ts/game-setup-mode';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import {
  GameLobbyDock,
  GameModeCard,
} from '@pkgs/ui-root-client-ts/game-lobby';
import { BotArt, FriendsArt } from '@pkgs/ui-root-client-ts/illustration';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { Text } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from '@solidjs/web';
import { For, Show } from 'solid-js';
import type { FramePlaceProps } from './custom-game-screen-view';
import {
  createFrameChoices,
  FrameChoiceRow,
  type FrameChoices,
} from './game-frame-choice';
import { FrameLobbyPage } from './game-frame-shell';

function NewGameSeat(props: {
  readonly choices: FrameChoices;
  readonly side: FramePlaceProps['sides'][number];
  readonly index: number;
  readonly onChoose: FramePlaceProps['onChoose'];
  readonly onOpen: FramePlaceProps['onOpen'];
}): JSX.Element {
  return (
    <FrameChoiceRow
      choices={props.choices}
      id={`custom-game-${props.side}-choices`}
      navigates
      title={<Trans>Seat {props.index + 1}</Trans>}
      caption={
        props.index === 0 ? (
          <Trans>You</Trans>
        ) : (
          <Trans>Open seat · Invite a person or add a bot</Trans>
        )
      }
      operation={async () => {
        const open = props.onOpen;
        const side = props.side;
        await props.onChoose({ operation: 'create' });
        open({ screen: 'seat', side });
      }}
    />
  );
}

/**
 * Fresh setup shows the seats before the host commits to a mode. Editing a
 * seat opens the shared table and continues directly to that seat.
 */
export function CustomGamesHomePlace(props: FramePlaceProps): JSX.Element {
  const choices = createFrameChoices(() => undefined);
  return (
    <FrameLobbyPage
      connection={props.connection}
      error={props.error}
      status={props.status}
      phase={props.phase}
      place={props.place}
      screenId="custom-games-home"
      dock={
        props.canCreate && (
          <GameLobbyDock>
            <FrameChoiceRow
              choices={choices}
              id="custom-game-create"
              navigates
              leading={<FriendsArt />}
              title={<Trans>Play a Friend</Trans>}
              caption={
                <Trans>
                  Open table · Let people in this space take the open seats
                </Trans>
              }
              operation={() => props.onChoose({ operation: 'create' })}
            />
          </GameLobbyDock>
        )
      }
    >
      <GameModeCard
        // The same one line as the lobby and a ranked search: the mode,
        // then what it plays for.
        eyebrow={
          <>
            <Trans>Custom game</Trans>
            {'\u00a0· '}
            <Trans>Unrated</Trans>
          </>
        }
        title={props.title}
        summary={
          <Trans>
            A private game with the people in this space, or bots. Anyone in
            this space can watch.
          </Trans>
        }
        dataSet={{ testid: 'custom-game-mode' }}
      />
      <GameSetupMode disabled={choices.pending() !== null} />
      <Show
        when={props.canCreate}
        fallback={
          <Notice>
            <Text variant="inherit">
              <Trans>Waiting for the host to set up a game.</Trans>
            </Text>
          </Notice>
        }
      >
        <MenuSection
          title={<Trans>Players</Trans>}
          dataSet={{ testid: 'custom-game-setup-seats' }}
        >
          <For each={props.sides}>
            {(side, index) => (
              <NewGameSeat
                choices={choices}
                side={side}
                index={index()}
                onChoose={props.onChoose}
                onOpen={props.onOpen}
              />
            )}
          </For>
          <FrameChoiceRow
            choices={choices}
            id="custom-game-play-bot"
            navigates
            leading={<BotArt />}
            title={
              <Show
                when={props.sides.length > 2}
                fallback={<Trans>Play a bot</Trans>}
              >
                <Trans>Play against bots</Trans>
              </Show>
            }
            caption={
              <Show
                when={props.connection === 'needed'}
                fallback={<Trans>Start playing now</Trans>}
              >
                <Trans>Starts when you are back online</Trans>
              </Show>
            }
            operation={() => props.onPlayBot()}
          />
        </MenuSection>
      </Show>
    </FrameLobbyPage>
  );
}
