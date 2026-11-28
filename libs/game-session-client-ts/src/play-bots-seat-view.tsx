import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import type { BotDifficulty } from '@pkgs/turn-game-shared-ts/game-rules';
import { MascotPortrait } from '@pkgs/ui-root-client-ts/app-logo';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from '@solidjs/web';
import { For, Match, Switch } from 'solid-js';
import { createFrameChoices, FrameChoiceRow } from './game-frame-choice';
import { FramePlacePage } from './game-frame-shell';
import type { FrameSetupSeat } from './game-frame-view-types';
import type { FramePlaceProps } from './game-session-screen-view';

/**
 * One bot's strength. A bot game has no other choice about a seat: the
 * seat is a bot, and this place only sets how it plays.
 */
export function BotDifficultyPlace(
  props: FramePlaceProps & { readonly seat: FrameSetupSeat }
): JSX.Element {
  const choices = createFrameChoices(() => props.onClose());
  const offered = () => props.seat.choices;
  return (
    <FramePlacePage
      {...props}
      screenId="play-bots-difficulty"
      back={<Trans>Back to setup</Trans>}
      title={props.seat.sideLabel}
    >
      <MenuSection
        title={
          <StackHorizontal align="center" gap="sm">
            <MascotPortrait />
            <Trans>How this bot plays</Trans>
          </StackHorizontal>
        }
      >
        <For each={offered()?.difficulties ?? []}>
          {(difficulty) => (
            <FrameChoiceRow
              choices={choices}
              id={`play-bots-${props.seat.side}-difficulty-${difficulty}`}
              title={<DifficultyName difficulty={difficulty} />}
              selected={offered()?.difficulty === difficulty}
              operation={() =>
                props.onChoose({
                  operation: 'difficulty',
                  side: props.seat.side,
                  difficulty,
                })
              }
            />
          )}
        </For>
      </MenuSection>
    </FramePlacePage>
  );
}

function DifficultyName(props: {
  readonly difficulty: BotDifficulty;
}): JSX.Element {
  return (
    <Switch fallback={<Trans>Hard</Trans>}>
      <Match when={props.difficulty === 'easy'}>
        <Trans>Easy</Trans>
      </Match>
      <Match when={props.difficulty === 'medium'}>
        <Trans>Medium</Trans>
      </Match>
    </Switch>
  );
}
