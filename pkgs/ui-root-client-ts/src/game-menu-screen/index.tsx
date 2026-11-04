/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { For, type JSX, Show } from 'solid-js';
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
import { useLayoutMode } from '../use-layout-mode';
import styles from './game-menu-screen.module.css';

/** One way into a game: a menu row on a phone, a large tile when wide. */
export type GameMenuChoice = Pick<
  MainMenuItem,
  'key' | 'title' | 'caption' | 'emphasis' | 'dataSet'
> & {
  /** What the choice is, as a picture heading its tile. */
  icon: IconComponent;
  onClick: () => void;
};

export type GameMenuScreenProps = {
  /** Stable screen identifier rendered as `data-screen`. */
  screenId: string;
  /** The game's name. */
  title: JSX.Element;
  /** The game's picture. */
  motif: GameTileMotif;
  /** One line under the name: what the game is. */
  subtitle?: JSX.Element | undefined;
  /** How to play, in a sentence or two. */
  description?: JSX.Element | undefined;
  choices: readonly GameMenuChoice[];
  dataSet?: ComponentDataSet | undefined;
};

/** A choice as a large tile: its picture, name, what it opens, a chevron. */
function ChoiceTile(props: { choice: GameMenuChoice }): JSX.Element {
  const confirmNavigation = useConfirmNavigation();
  const Icon = (): JSX.Element => {
    const Picture = props.choice.icon;
    return <Picture size={24} />;
  };
  return (
    <button
      type="button"
      class={`${styles['tile']} clickable clickableTint`}
      data-emphasis={props.choice.emphasis}
      onClick={() => confirmNavigation(() => props.choice.onClick())}
      {...dataAttrs({ component: 'GameMenuChoice', ...props.choice.dataSet })}
    >
      <span class={styles['icon']} aria-hidden="true">
        <Icon />
      </span>
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

/** Wide: the game's hero block, then every choice as a large tile. */
function WideGameMenu(props: GameMenuScreenProps): JSX.Element {
  const subtitle = createScreenSlot(() => props.subtitle);
  const description = createScreenSlot(() => props.description);
  // Two or four choices take two columns, so none is left alone on a row.
  const columns = (): number =>
    props.choices.length === 2 || props.choices.length === 4 ? 2 : 3;
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
          <Show when={description.present()}>
            <p class={`${styles['description']} text textCaption`}>
              {description.content()}
            </p>
          </Show>
        </div>
      </header>
      <div
        class={styles['grid']}
        style={{ '--game-menu-columns': String(columns()) }}
        role="list"
        data-layout="grid"
      >
        <For each={props.choices}>
          {(choice) => (
            <div class={styles['item']} role="listitem">
              <ChoiceTile choice={choice} />
            </div>
          )}
        </For>
      </div>
    </EmbeddedScreen>
  );
}

/**
 * `GameMenuScreen` -- a game's own menu inside a space: the ways into the
 * game (puzzles, playing with friends or bots, finding an opponent, its
 * history, its settings). On a wide screen it opens with a hero block (the
 * game's `GameTile` at its largest, its name, what it is and how to play)
 * and lays every choice out as a large tile with its picture, the main way
 * in (`emphasis: 'primary'`) leading in the accent's soft fill and the
 * quiet ones (`'quiet'`) on the plain surface with secondary pictures. On a
 * phone it is a `MainMenuScreen`: the name beside the tile, then one panel
 * of rows. Presentational; the caller opens what each choice names.
 *
 * @example
 * ```tsx
 * <GameMenuScreen
 *   screenId="game-choices"
 *   title="Connect Four"
 *   motif="discs"
 *   subtitle="Drop discs and line up four"
 *   choices={[{ key: 'custom-game', title: 'Play with friends or bots',
 *     icon: UsersIcon, emphasis: 'primary', onClick: openCustomGame }]}
 * />
 * ```
 */
export function GameMenuScreen(props: GameMenuScreenProps): JSX.Element {
  const mode = useLayoutMode();
  const description = createScreenSlot(() => props.description);
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
          items={props.choices}
          helper={
            <Show when={description.present()}>{description.content()}</Show>
          }
        />
      }
    >
      <WideGameMenu {...props} />
    </Show>
  );
}
