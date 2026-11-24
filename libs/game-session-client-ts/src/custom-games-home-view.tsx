import { Trans } from '@lingui/solid/macro';
import { GameModeCard } from '@pkgs/ui-root-client-ts/game-lobby';
import { BotIcon, UsersIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';
import type { FramePlaceProps } from './custom-game-screen-view';
import { createFrameChoices, FrameChoiceRow } from './game-frame-choice';
import { FrameLobbyPage } from './game-frame-shell';

/**
 * Before any game: what a custom game is, then play the bots at once, or
 * set a game up with people.
 * Someone who may not create one is told who will.
 */
export function CustomGamesHomePlace(props: FramePlaceProps): JSX.Element {
  // Either choice makes a game, and the game's own phase moves the screen on.
  const choices = createFrameChoices(() => undefined);
  return (
    <FrameLobbyPage
      connection={props.connection}
      error={props.error}
      status={props.status}
      phase={props.phase}
      place={props.place}
      screenId="custom-games-home"
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
        <MenuSection title={<Trans>New game</Trans>}>
          <FrameChoiceRow
            choices={choices}
            id="custom-game-play-bot"
            navigates
            leading={<BotIcon size={24} />}
            title={
              <Show
                when={props.playerCount > 2}
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
          <FrameChoiceRow
            choices={choices}
            id="custom-game-create"
            navigates
            leading={<UsersIcon size={24} />}
            title={<Trans>Play with people</Trans>}
            caption={<Trans>Choose who sits where, then start</Trans>}
            operation={() => props.onChoose({ operation: 'create' })}
          />
        </MenuSection>
      </Show>
    </FrameLobbyPage>
  );
}
