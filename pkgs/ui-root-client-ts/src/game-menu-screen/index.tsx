/** @jsxImportSource @solidjs/web */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { Button as SdkButton } from '@ui-sdk/solid/button';
import { createMemo, For, Show } from 'solid-js';
import type { IconComponent } from '../create-icon/index';
import { EmbeddedScreen } from '../embedded-screen/index';
import {
  GameTile,
  type GameTileMotif,
  GameTitleLockup,
} from '../game-tile/index';
import { ChevronRightIcon } from '../icons';
import type { MainMenuItem } from '../main-menu-item-row/index';
import { MainMenuScreen } from '../main-menu-screen/index';
import { useConfirmNavigation } from '../pending-navigation';
import { createScreenSlot } from '../screen-slot';
import { type Segment, SegmentedControl } from '../segmented-control/index';
import { useLayoutMode } from '../use-layout-mode';
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
  /** For a game with several modes: which one is set up, and switching it. */
  modes?: GameMenuModes | undefined;
  dataSet?: ComponentDataSet | undefined;
};

/** A game's modes, one chosen, above its choices. */
export type GameMenuModes = {
  /** Accessible name for the mode choice. */
  label: string;
  segments: readonly Segment[];
  selected: string;
  /** Unset where this person cannot switch the mode: it only shows. */
  onSelect?: ((key: string) => void) | undefined;
  /** The group's `data-testid`; each mode is `<testId>-<key>`. */
  testId?: string | undefined;
};

/** The game's modes as one segmented choice, shown under its name. */
function ModeChoice(props: { modes: GameMenuModes }): JSX.Element {
  return (
    <SegmentedControl
      aria-label={props.modes.label}
      segments={props.modes.segments}
      selected={props.modes.selected}
      onSelect={(key) => props.modes.onSelect?.(key)}
      disabled={props.modes.onSelect === undefined}
      dataSet={
        props.modes.testId === undefined
          ? undefined
          : { testid: props.modes.testId }
      }
    />
  );
}

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

/**
 * Wide: the game's hero block, then every way to play as a tile of one
 * size (the same title, as tall as its words) and, under them, the quiet
 * choices (history, stats, settings) as compact outlined rows that share
 * the tiles' edges: one alone spans the tiles' full width, never a
 * half-width row orphaned under them nor a box floating at the hero's end.
 * A menu of quiet choices only shows them all as tiles.
 */
function WideGameMenu(props: GameMenuScreenProps): JSX.Element {
  const subtitle = createScreenSlot(() => props.subtitle);
  const split = createMemo(() => {
    const quiet = props.choices.filter((c) => c.emphasis === 'quiet');
    const loud = props.choices.filter((c) => c.emphasis !== 'quiet');
    return loud.length === 0
      ? { tiles: props.choices, links: [] }
      : { tiles: loud, links: quiet };
  });
  // Two or four tiles take two columns, so none is left alone on a row.
  const columns = (): number =>
    split().tiles.length === 2 || split().tiles.length === 4 ? 2 : 3;
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
            <p class="text textSubtitle min-w-0">{subtitle.content()}</p>
          </Show>
        </div>
      </header>
      <Show when={props.modes}>
        {(modes) => <ModeChoice modes={modes()} />}
      </Show>
      <div
        class={styles['grid']}
        style={{ '--game-menu-columns': String(columns()) }}
        role="list"
        data-layout="grid"
      >
        <For each={split().tiles}>
          {(choice) => (
            <div class={styles['item']} role="listitem">
              <ChoiceTile choice={choice} />
            </div>
          )}
        </For>
      </div>
      <Show when={split().links.length > 0}>
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
      </Show>
    </EmbeddedScreen>
  );
}

/**
 * `GameMenuScreen` -- a game's own menu inside a space: the ways into the
 * game (puzzles, playing with friends or bots, finding an opponent, its
 * history, its settings, how to play). It holds rows that lead onward and
 * nothing else: how the game is played is a screen of its own, opened by a
 * choice. On a wide screen it opens with a hero block (the game's `GameTile`
 * at its largest, its name and what it is) and lays every choice out as a
 * large tile with its picture; on a phone it
 * is a `MainMenuScreen`: the name beside the tile, then one panel of rows,
 * each led by the same picture. Every way to play weighs the same: the
 * menu never recommends one; the quiet ones (`'quiet'`) have secondary
 * pictures. A game with several modes (`modes`) shows which one is set up
 * as a segmented choice between its name and its choices.
 * Presentational; the caller opens what each choice names.
 *
 * @example
 * ```tsx
 * <GameMenuScreen
 *   screenId="game-home"
 *   title="Connect Four"
 *   motif="discs"
 *   subtitle="Drop discs and line up four"
 *   choices={[{ key: 'custom-game', title: 'Play with friends or bots',
 *     icon: UsersIcon, onClick: openCustomGame }]}
 * />
 * ```
 */
export function GameMenuScreen(props: GameMenuScreenProps): JSX.Element {
  const mode = useLayoutMode();
  const rows = createMemo((): MainMenuItem[] =>
    props.choices.map((choice) => ({
      key: choice.key,
      title: choice.title,
      caption: choice.caption,
      emphasis: choice.emphasis,
      dataSet: choice.dataSet,
      onClick: choice.onClick,
      leading: <ChoiceIcon choice={choice} size="row" />,
    }))
  );
  return (
    <Show
      when={mode() === 'wide'}
      fallback={
        <MainMenuScreen
          screenId={props.screenId}
          dataSet={props.dataSet}
          title={
            <GameTitleLockup tile={<GameTile motif={props.motif} size="lg" />}>
              {props.title}
            </GameTitleLockup>
          }
          subtitle={props.subtitle}
          helper={
            props.modes === undefined ? undefined : (
              <ModeChoice modes={props.modes} />
            )
          }
          items={rows()}
        />
      }
    >
      <WideGameMenu {...props} />
    </Show>
  );
}
