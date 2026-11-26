/** @jsxImportSource @solidjs/web */

import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { Button as SdkButton } from '@ui-sdk/solid/button';
import { createMemo, For, Show } from 'solid-js';
import type { IconComponent } from '../create-icon/index';
import { DisclosureCard } from '../disclosure-card/index';
import { EmbeddedScreen } from '../embedded-screen/index';
import { GameTile, type GameTileMotif } from '../game-tile/index';
import { ChevronRightIcon } from '../icons';
import type { MainMenuItem } from '../main-menu-item-row/index';
import { useConfirmNavigation } from '../pending-navigation';
import { createScreenSlot } from '../screen-slot';
import styles from './game-menu-screen.module.css';

/** One way into a game: a menu row on a phone, a large tile when wide. */
export type GameMenuChoice = Pick<
  MainMenuItem,
  'key' | 'title' | 'caption' | 'dataSet'
> & {
  /** What the choice is, as a picture heading its tile (or its row). */
  icon: IconComponent;
  /**
   * `quiet`: a look back or a setting, never a way to play. No choice
   * leads: the menu never recommends one way to play over another.
   */
  emphasis?: 'quiet' | undefined;
  onClick: () => void;
};

/** A choice's picture in its rounded square. */
function ChoiceIcon(props: {
  choice: GameMenuChoice;
  size: 'row' | 'tile';
}): JSX.Element {
  const Picture = (): JSX.Element => {
    const Icon = props.choice.icon;
    return <Icon size={props.size === 'tile' ? 24 : 20} />;
  };
  return (
    <span
      class={styles['icon']}
      data-size={props.size}
      data-emphasis={props.choice.emphasis}
      aria-hidden="true"
    >
      <Picture />
    </span>
  );
}

export type GameMenuScreenProps = {
  /** Stable screen identifier rendered as `data-screen`. */
  screenId: string;
  /** The game's name. */
  title: JSX.Element;
  /** The game's picture. */
  motif: GameTileMotif;
  /** One line under the name: what the game is. */
  subtitle?: JSX.Element | undefined;
  choices: readonly GameMenuChoice[];
  dataSet?: ComponentDataSet | undefined;
};

/**
 * A choice as a tile, read in one line across: its picture, its name and
 * what it opens under it, then a
 * chevron centred at the far edge, level with the words. Sized by its
 * words, never a tall card of empty room.
 */
function ChoiceTile(props: { choice: GameMenuChoice }): JSX.Element {
  const confirmNavigation = useConfirmNavigation();
  return (
    <SdkButton
      type="button"
      class={`${styles['tile']} clickable clickableTint`}
      data-emphasis={props.choice.emphasis}
      onClick={() => confirmNavigation(props.choice.onClick)}
      {...dataAttrs({ component: 'GameMenuChoice', ...props.choice.dataSet })}
    >
      <ChoiceIcon choice={props.choice} size="tile" />
      <span class={styles['words']}>
        <span class={styles['titleRow']}>
          <span class={`${styles['title']} text textHeading`}>
            {props.choice.title}
          </span>
        </span>
        <Show when={props.choice.caption}>
          <span class={`${styles['caption']} text textCaption`}>
            {props.choice.caption}
          </span>
        </Show>
      </span>
      <span class={styles['chevron']} aria-hidden="true">
        <ChevronRightIcon size={20} />
      </span>
    </SdkButton>
  );
}

/**
 * A quiet choice (a look back, a setting) as a compact row under the tiles:
 * its small picture, its name and what it opens, a chevron. It never
 * weighs as much as a way to play.
 */
function ChoiceLink(props: { choice: GameMenuChoice }): JSX.Element {
  const confirmNavigation = useConfirmNavigation();
  return (
    <SdkButton
      type="button"
      class={`${styles['link']} clickable clickableTint`}
      data-emphasis={props.choice.emphasis}
      onClick={() => confirmNavigation(props.choice.onClick)}
      {...dataAttrs({ component: 'GameMenuChoice', ...props.choice.dataSet })}
    >
      <ChoiceIcon choice={props.choice} size="row" />
      <span class={styles['linkWords']}>
        <span class="text textBodyBold min-w-0 truncate">
          {props.choice.title}
        </span>
        <Show when={props.choice.caption}>
          <span class={`${styles['linkCaption']} text textCaption truncate`}>
            {props.choice.caption}
          </span>
        </Show>
      </span>
      <span class={styles['linkChevron']} aria-hidden="true">
        <ChevronRightIcon size={16} />
      </span>
    </SdkButton>
  );
}

/** Every game uses its registered play modes, then its secondary destinations. */
export function GameMenuScreen(props: GameMenuScreenProps): JSX.Element {
  const subtitle = createScreenSlot(() => props.subtitle);
  const split = createMemo(() => {
    const quiet = props.choices.filter((c) => c.emphasis === 'quiet');
    const loud = props.choices.filter((c) => c.emphasis !== 'quiet');
    return loud.length === 0
      ? { tiles: props.choices, links: [] }
      : { tiles: loud, links: quiet };
  });
  return (
    <EmbeddedScreen
      screenId={props.screenId}
      width="menu"
      dataSet={{ component: 'GameMenuScreen', ...props.dataSet }}
    >
      <header class={styles['hero']} data-layout="hero">
        <GameTile motif={props.motif} size="xl" />
        <div class={styles['heroWords']}>
          <h1 class="text textTitle min-w-0 break-words">{props.title}</h1>
          <Show when={subtitle.present()}>
            <p class="text textSubtitle min-w-0">{subtitle.content()}</p>
          </Show>
        </div>
      </header>
      <div class={styles['grid']} role="list" data-layout="grid">
        <For each={split().tiles}>
          {(choice) => (
            <div class={styles['item']} role="listitem">
              <ChoiceTile choice={choice} />
            </div>
          )}
        </For>
      </div>
      <Show when={split().links.length > 0}>
        <DisclosureCard title={<Trans>More</Trans>} defaultOpen>
          <div class={styles['links']} role="list" data-layout="links">
            <For each={split().links}>
              {(choice) => (
                <div class={styles['item']} role="listitem">
                  <ChoiceLink choice={choice} />
                </div>
              )}
            </For>
          </div>
        </DisclosureCard>
      </Show>
    </EmbeddedScreen>
  );
}
