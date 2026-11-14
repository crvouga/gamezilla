/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createMemo, For, type JSX, Show } from 'solid-js';
import { Button } from '../button/index';
import type { IconComponent } from '../create-icon/index';
import { EmbeddedScreen } from '../embedded-screen/index';
import {
  GameTile,
  type GameTileMotif,
  GameTitleLockup,
} from '../game-tile/index';
import { ChevronRightIcon, ScrollTextIcon } from '../icons';
import {
  type MainMenuItem,
  MainMenuItemRow,
} from '../main-menu-item-row/index';
import { useConfirmNavigation } from '../pending-navigation';
import { createScreenSlot } from '../screen-slot';
import { useLayoutMode } from '../use-layout-mode';
import styles from './game-menu-screen.module.css';

/** One way into a game: a menu row on a phone, a large tile when wide. */
export type GameMenuChoice = Pick<
  MainMenuItem,
  'key' | 'title' | 'caption' | 'emphasis' | 'dataSet'
> & {
  /** What the choice is, as a picture heading its tile (or its row). */
  icon: IconComponent;
  onClick: () => void;
};

/** A choice's picture in its rounded square: the accent's for the main way in. */
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
  /**
   * The names of the menu's two groups: the ways to play (every choice not
   * `quiet`) and the rest (`quiet`: a look back, settings), each over its
   * choices whenever it holds any.
   */
  groups?: { play: JSX.Element; more: JSX.Element } | undefined;
  /**
   * How the game is played, offered under its name so a newcomer meets it
   * before choosing (`How to play`). Omit when the game says nothing.
   */
  howToPlay?: GameMenuHowToPlay | undefined;
  dataSet?: ComponentDataSet | undefined;
};

/** The way to the game's rules, under its name. */
export type GameMenuHowToPlay = {
  label: JSX.Element;
  onClick: () => void;
  dataSet?: ComponentDataSet | undefined;
};

/** The ways to play and the quiet choices, apart, in the order given. */
function splitChoices(choices: readonly GameMenuChoice[]): {
  play: readonly GameMenuChoice[];
  more: readonly GameMenuChoice[];
} {
  return {
    play: choices.filter((c) => c.emphasis !== 'quiet'),
    more: choices.filter((c) => c.emphasis === 'quiet'),
  };
}

/** The rules' button under the game's name: outlined, the scroll before it. */
function HowToPlayButton(props: { howToPlay: GameMenuHowToPlay }): JSX.Element {
  // A place of the menu's own, never a navigation that could lose work.
  return (
    <Button
      title={props.howToPlay.label}
      icon={ScrollTextIcon}
      intent="neutral"
      variant="outline"
      size="sm"
      onClick={props.howToPlay.onClick}
      dataSet={props.howToPlay.dataSet}
    />
  );
}

/** A group's name over its choices, on the rows' text column. */
function GroupLabel(props: {
  children: JSX.Element;
  wide?: boolean | undefined;
}): JSX.Element {
  return (
    <h2
      class={`${styles['groupLabel']} text textSectionLabel`}
      data-wide={props.wide === true ? '' : undefined}
    >
      {props.children}
    </h2>
  );
}

/**
 * A choice as a tile, read in one line across: its picture, its name with
 * the main way in's tag beside it and what it opens under them, then a
 * chevron centred at the far edge, level with the words. Sized by its
 * words, never a tall card of empty room.
 */
function ChoiceTile(props: { choice: GameMenuChoice }): JSX.Element {
  const confirmNavigation = useConfirmNavigation();
  return (
    <button
      type="button"
      class={`${styles['tile']} clickable clickableTint`}
      data-emphasis={props.choice.emphasis}
      onClick={() => confirmNavigation(() => props.choice.onClick())}
      {...dataAttrs({ component: 'GameMenuChoice', ...props.choice.dataSet })}
    >
      <ChoiceIcon choice={props.choice} size="tile" />
      <span class={styles['words']}>
        <span class={`${styles['title']} text textHeading`}>
          {props.choice.title}
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
    </button>
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
    <button
      type="button"
      class={`${styles['link']} clickable clickableTint`}
      data-emphasis={props.choice.emphasis}
      onClick={() => confirmNavigation(() => props.choice.onClick())}
      {...dataAttrs({ component: 'GameMenuChoice', ...props.choice.dataSet })}
    >
      <ChoiceIcon choice={props.choice} size="row" />
      <span class={styles['linkWords']}>
        <span class="text textBodyBold min-w-0 break-words">
          {props.choice.title}
        </span>
        <Show when={props.choice.caption}>
          <span class={`${styles['linkCaption']} text textCaption`}>
            {props.choice.caption}
          </span>
        </Show>
      </span>
      <span class={styles['linkChevron']} aria-hidden="true">
        <ChevronRightIcon size={16} />
      </span>
    </button>
  );
}

/**
 * Wide: the game's hero block (its name, what it is and the way to its
 * rules), then the ways to play as tiles of one size (the same title, as
 * tall as their words) and, under them, the quiet choices (history, stats,
 * settings) as compact outlined rows that share the tiles' edges: one alone
 * spans the tiles' full width, never a half-width row orphaned under them.
 * Each group is named when the menu holds both. A menu of quiet choices
 * only shows them all as tiles.
 */
function WideGameMenu(props: GameMenuScreenProps): JSX.Element {
  const subtitle = createScreenSlot(() => props.subtitle);
  const split = createMemo(() => {
    const { play, more } = splitChoices(props.choices);
    return play.length === 0
      ? { tiles: props.choices, links: [] }
      : { tiles: play, links: more };
  });
  const named = (): boolean => props.groups !== undefined;
  // Two to four tiles take two columns, so none is left alone on a row:
  // of three, the lead spans the first row.
  const columns = (): number => {
    const count = split().tiles.length;
    if (count === 1) return 1;
    return count <= 4 ? 2 : 3;
  };
  const spans = (index: number): boolean =>
    index === 0 &&
    split().tiles.length === 3 &&
    split().tiles[0]?.emphasis === 'primary';
  return (
    <EmbeddedScreen
      screenId={props.screenId}
      width="full"
      dataSet={{ component: 'GameMenuScreen', ...props.dataSet }}
    >
      <header class={styles['hero']} data-layout="hero">
        <GameTile motif={props.motif} size="xl" />
        <div class={styles['heroWords']}>
          <h1 class="text textTitle min-w-0 break-words">{props.title}</h1>
          <Show when={subtitle.present()}>
            <p class={`${styles['tagline']} text textBody min-w-0`}>
              {subtitle.content()}
            </p>
          </Show>
          <Show when={props.howToPlay} keyed>
            {(howToPlay) => (
              <div class={styles['heroAction']}>
                <HowToPlayButton howToPlay={howToPlay} />
              </div>
            )}
          </Show>
        </div>
      </header>
      <section class={styles['group']} data-layout="play">
        <Show when={named()}>
          <GroupLabel wide>{props.groups?.play}</GroupLabel>
        </Show>
        <div
          class={styles['grid']}
          style={{ '--game-menu-columns': String(columns()) }}
          role="list"
          data-layout="grid"
        >
          <For each={split().tiles}>
            {(choice, index) => (
              <div
                class={styles['item']}
                role="listitem"
                data-span={spans(index()) ? 'row' : undefined}
              >
                <ChoiceTile choice={choice} />
              </div>
            )}
          </For>
        </div>
      </section>
      <Show when={split().links.length > 0}>
        <section class={styles['group']} data-layout="more">
          <Show when={named()}>
            <GroupLabel wide>{props.groups?.more}</GroupLabel>
          </Show>
          <div
            class={styles['links']}
            style={{
              // One across the tiles' full width, else up to three a row.
              '--game-menu-link-columns': String(
                Math.min(3, split().links.length)
              ),
            }}
            role="list"
            data-layout="links"
          >
            <For each={split().links}>
              {(choice) => (
                <div class={styles['item']} role="listitem">
                  <ChoiceLink choice={choice} />
                </div>
              )}
            </For>
          </div>
        </section>
      </Show>
    </EmbeddedScreen>
  );
}

/** A choice as a phone's menu row, led by its picture. */
function choiceRow(choice: GameMenuChoice): MainMenuItem {
  return {
    key: choice.key,
    title: choice.title,
    caption: choice.caption,
    emphasis: choice.emphasis,
    dataSet: choice.dataSet,
    onClick: choice.onClick,
    leading: <ChoiceIcon choice={choice} size="row" />,
  };
}

/** One group of a phone's menu: its name, then one panel of rows. */
function CompactGroup(props: {
  label: JSX.Element | undefined;
  choices: readonly GameMenuChoice[];
  layout: 'play' | 'more';
}): JSX.Element {
  return (
    <section class={styles['group']} data-layout={props.layout}>
      <Show when={props.label !== undefined}>
        <GroupLabel>{props.label}</GroupLabel>
      </Show>
      <div class="panel self-stretch" role="list">
        <For each={props.choices}>
          {(choice) => (
            <div class="panelItem" role="listitem">
              <MainMenuItemRow item={choiceRow(choice)} />
            </div>
          )}
        </For>
      </div>
    </section>
  );
}

/**
 * Compact: the name beside the tile, what the game is and the way to its
 * rules, then the ways to play as one panel of rows and the quiet choices
 * as another, each named when there are both. The main way in leads its
 * panel by its picture on the accent; its tag is left to the wide tiles,
 * where it fits beside the title instead of pushing the row onto two lines.
 */
function CompactGameMenu(props: GameMenuScreenProps): JSX.Element {
  const subtitle = createScreenSlot(() => props.subtitle);
  const split = createMemo(() => splitChoices(props.choices));
  const named = (): boolean => props.groups !== undefined;
  return (
    <EmbeddedScreen
      screenId={props.screenId}
      dataSet={{ component: 'GameMenuScreen', ...props.dataSet }}
    >
      <header class={styles['compactHero']} data-layout="hero">
        <h1 class="text textTitle min-w-0 break-words">
          <GameTitleLockup tile={<GameTile motif={props.motif} size="lg" />}>
            {props.title}
          </GameTitleLockup>
        </h1>
        <Show when={subtitle.present()}>
          <p class={`${styles['tagline']} text textBody min-w-0`}>
            {subtitle.content()}
          </p>
        </Show>
        <Show when={props.howToPlay} keyed>
          {(howToPlay) => (
            <div class={styles['heroAction']}>
              <HowToPlayButton howToPlay={howToPlay} />
            </div>
          )}
        </Show>
      </header>
      <Show when={split().play.length > 0}>
        <CompactGroup
          label={named() ? props.groups?.play : undefined}
          choices={split().play}
          layout="play"
        />
      </Show>
      <Show when={split().more.length > 0}>
        <CompactGroup
          label={named() ? props.groups?.more : undefined}
          choices={split().more}
          layout="more"
        />
      </Show>
    </EmbeddedScreen>
  );
}

/**
 * `GameMenuScreen` -- a game's own menu inside a space: the ways into the
 * game (puzzles, playing with friends or bots, finding an opponent) and,
 * apart from them, the quiet choices (its history, its settings), with the
 * way to how the game is played under its name. It holds choices that lead
 * onward and nothing else: the rules are a screen of their own. On a wide
 * screen it opens with a hero block (the game's `GameTile` at its largest,
 * its name, what it is, the rules' button) and lays every way to play out
 * as a large tile with its picture; on a phone the name sits beside the
 * tile and the choices are panels of rows, each led by the same picture.
 * Either way the main way in (`emphasis: 'primary'`) comes first under
 * "Play" with its picture on the accent (wide, an accent edge too), never a
 * fill, which would read as already chosen, nor a tag that wraps under a
 * title naming bots. The quiet ones (`'quiet'`) have secondary pictures. Presentational; the caller
 * opens what each choice names.
 *
 * @example
 * ```tsx
 * <GameMenuScreen
 *   screenId="game-choices"
 *   title="Connect Four"
 *   motif="discs"
 *   subtitle="Drop discs and line up four"
 *   groups={{ play: 'Play', more: 'More' }}
 *   howToPlay={{ label: 'How to play', onClick: openRules }}
 *   choices={[{ key: 'custom-game', title: 'Play with friends or bots',
 *     icon: UsersIcon, emphasis: 'primary', onClick: openCustomGame }]}
 * />
 * ```
 */
export function GameMenuScreen(props: GameMenuScreenProps): JSX.Element {
  const mode = useLayoutMode();
  return (
    <Show when={mode() === 'wide'} fallback={<CompactGameMenu {...props} />}>
      <WideGameMenu {...props} />
    </Show>
  );
}
