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

/**
 * One way into a game: the primary control when it is the first way to
 * play, a full-width row for any other way to play, a row behind More when
 * quiet.
 */
export type GameMenuChoice = Pick<
  MainMenuItem,
  'key' | 'title' | 'caption' | 'dataSet'
> & {
  /** What the choice is, as a picture heading its tile (or its row). */
  icon: IconComponent;
  /**
   * `quiet`: a look back or a setting, never a way to play; it waits behind
   * More. Every other choice is a way to play, and the first of them leads
   * the menu as its one primary control.
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
    return <Icon />;
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
  /** In the order shown: the first way to play (not `quiet`) is primary. */
  choices: readonly GameMenuChoice[];
  /** Rendered as the More toggle's `data-testid`. */
  moreTestId?: string | undefined;
  dataSet?: ComponentDataSet | undefined;
};

/** The menu's choices sorted by how they are drawn. */
type MenuSplit = {
  /** The first way to play, drawn as the one primary control. */
  primary: GameMenuChoice | undefined;
  /** The other ways to play, full-width rows. */
  rows: readonly GameMenuChoice[];
  /** Looks back and settings, behind More. */
  more: readonly GameMenuChoice[];
};

function splitChoices(choices: readonly GameMenuChoice[]): MenuSplit {
  const quiet = choices.filter((c) => c.emphasis === 'quiet');
  const [primary, ...rows] = choices.filter((c) => c.emphasis !== 'quiet');
  // A menu with no way to play shows what it has, as rows, with no More.
  return primary === undefined
    ? { primary: undefined, rows: quiet, more: [] }
    : { primary, rows, more: quiet };
}

/**
 * The first way to play: one prominent full-width control, its name over
 * what it opens. It stands above every other choice, so opening More below
 * never moves it.
 */
function ChoicePrimary(props: { choice: GameMenuChoice }): JSX.Element {
  const confirmNavigation = useConfirmNavigation();
  const Picture = (): JSX.Element => {
    const Icon = props.choice.icon;
    return <Icon />;
  };
  return (
    <SdkButton
      type="button"
      class={`${styles['primary']} clickable`}
      data-emphasis="primary"
      onClick={() => confirmNavigation(props.choice.onClick)}
      {...dataAttrs({ component: 'GameMenuChoice', ...props.choice.dataSet })}
    >
      <span class={styles['primaryTitle']}>
        <span aria-hidden="true" class={styles['primaryIcon']}>
          <Picture />
        </span>
        <span class="text textHeading min-w-0">{props.choice.title}</span>
      </span>
      <Show when={props.choice.caption}>
        <span class={`${styles['primaryCaption']} text textCaption`}>
          {props.choice.caption}
        </span>
      </Show>
    </SdkButton>
  );
}

/**
 * A choice as a row, read in one line across: its picture, its name and
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

/** The quiet choices, behind a More control that starts closed. */
function MoreChoices(props: {
  choices: readonly GameMenuChoice[];
  testId: string | undefined;
}): JSX.Element {
  return (
    <DisclosureCard title={<Trans>More</Trans>} toggleTestId={props.testId}>
      <div class={styles['links']} role="list" data-layout="links">
        <For each={props.choices}>
          {(choice) => (
            <div class={styles['item']} role="listitem">
              <ChoiceLink choice={choice} />
            </div>
          )}
        </For>
      </div>
    </DisclosureCard>
  );
}

/**
 * A game's menu: its first way to play as one primary control, its other
 * ways to play as full-width rows, and its looks back and settings behind
 * More, closed until opened and opening in place under the rows.
 */
export function GameMenuScreen(props: GameMenuScreenProps): JSX.Element {
  const subtitle = createScreenSlot(() => props.subtitle);
  const split = createMemo(() => splitChoices(props.choices));
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
      <Show when={split().primary} keyed>
        {(choice) => (
          <div class={styles['lead']} data-layout="primary">
            <ChoicePrimary choice={choice} />
          </div>
        )}
      </Show>
      <Show when={split().rows.length > 0}>
        <div class={styles['grid']} role="list" data-layout="grid">
          <For each={split().rows}>
            {(choice) => (
              <div class={styles['item']} role="listitem">
                <ChoiceTile choice={choice} />
              </div>
            )}
          </For>
        </div>
      </Show>
      <Show when={split().more.length > 0}>
        <MoreChoices choices={split().more} testId={props.moreTestId} />
      </Show>
    </EmbeddedScreen>
  );
}
