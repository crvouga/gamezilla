import { Trans } from '@lingui/solid/macro';
import { BotIcon, UsersIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';
import { createFrameChoices, FrameChoiceRow } from './game-frame-choice';
import type { FramePlaceProps } from './game-frame-screen-view';
import { FramePlacePage } from './game-frame-shell';

/**
 * Before any game: play the bots at once, or set a game up with people.
 * Someone who may not create one is told who will.
 */
export function FrameStartPlace(props: FramePlaceProps): JSX.Element {
  // Either choice makes a game, and the game's own phase moves the screen on.
  const choices = createFrameChoices(() => undefined);
  return (
    <FramePlacePage
      {...props}
      screenId="custom-game-start"
      title={props.title}
      subtitle={<Trans>Anyone in this space can watch.</Trans>}
    >
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
