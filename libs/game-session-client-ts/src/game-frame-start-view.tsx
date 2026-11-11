import { Trans } from '@lingui/solid/macro';
import { GameModeCard } from '@pkgs/ui-root-client-ts/game-lobby';
import { BotIcon, UsersIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';
import { createFrameChoices, FrameChoiceRow } from './game-frame-choice';
import type { FramePlaceProps } from './game-frame-screen-view';
import { FramePlacePage } from './game-frame-shell';

/**
 * Before any game: what a custom game is, then play the bots at once, or
 * set a game up with people.
 * Someone who may not create one is told who will.
 */
export function FrameStartPlace(props: FramePlaceProps): JSX.Element {
  // Either choice makes a game, and the game's own phase moves the screen on.
  const choices = createFrameChoices(() => undefined);
  return (
    <FramePlacePage
      connection={props.connection}
      error={props.error}
      status={props.status}
      phase={props.phase}
      place={props.place}
      screenId="custom-game-start"
    >
      <GameModeCard
        eyebrow={<Trans>Custom game</Trans>}
        title={props.title}
        summary={
          <Trans>
            A private, unrated game with the people in this space, or bots.
            Anyone in this space can watch.
          </Trans>
        }
        dataSet={{ testid: 'custom-game-mode' }}
      />
      <Show
        when={props.canCreate}
        fallback={
          <Notice>
            <Text variant="inherit">
              <Trans>Waiting for the creator to create a game.</Trans>
            </Text>
          </Notice>
        }
      >
        <MenuSection title={<Trans>New game</Trans>}>
          <FrameChoiceRow
            choices={choices}
            id="custom-game-play-bot"
            leading={<BotIcon size={24} />}
            title={
              <Show
                when={props.playerCount > 2}
                fallback={<Trans>Play a bot</Trans>}
              >
                <Trans>Play against bots</Trans>
              </Show>
            }
            caption={<Trans>Start playing now</Trans>}
            operation={() => props.onPlayBot()}
          />
          <FrameChoiceRow
            choices={choices}
            id="custom-game-create"
            leading={<UsersIcon size={24} />}
            title={<Trans>Play with people</Trans>}
            caption={<Trans>Choose who sits where, then start</Trans>}
            operation={() => props.onChoose({ operation: 'create' })}
          />
        </MenuSection>
      </Show>
    </FramePlacePage>
  );
}
