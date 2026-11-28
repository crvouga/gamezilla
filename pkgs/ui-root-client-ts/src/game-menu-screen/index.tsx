/** @jsxImportSource @solidjs/web */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { dynamic, type JSX } from '@solidjs/web';
import { Button as SdkButton } from '@ui-sdk/solid/button';
import { createMemo, For } from 'solid-js';
import type { IconComponent } from '../create-icon/index';
import { EmbeddedScreen } from '../embedded-screen/index';
import { GameTile, type GameTileMotif } from '../game-tile/index';
import { ChevronRightIcon } from '../icons';
import type { MainMenuItem } from '../main-menu-item-row/index';
import { useConfirmNavigation } from '../pending-navigation';
import { useLayoutMode } from '../use-layout-mode';
import styles from './game-menu-screen.module.css';

/**
 * A destination on the game menu. The first way to play is the primary action.
 */
export type GameMenuChoice = Pick<
  MainMenuItem,
  'key' | 'title' | 'caption' | 'dataSet'
> & {
  /** What the choice is, as a picture heading its tile (or its row). */
  icon: IconComponent;
  /** A supporting destination such as history, settings or instructions. */
  emphasis?: 'quiet' | undefined;
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
  /** In the order shown: the first way to play (not `quiet`) is primary. */
  choices: readonly GameMenuChoice[];
  dataSet?: ComponentDataSet | undefined;
};

/**
 * A choice as a row, read in one line across: its picture, its name, then
 * a chevron centred at the far edge, level with the words. Sized by its
 * words, never a tall card of empty room. The primary choice stands on a
 * firm accent foot, its chevron a filled play disc.
 */
function ChoiceTile(props: {
  choice: GameMenuChoice;
  primary?: boolean;
}): JSX.Element {
  const confirmNavigation = useConfirmNavigation();
  const Artwork = dynamic(() => props.choice.icon);
  return (
    <SdkButton
      type="button"
      class={`${styles['tile']} clickable clickableTint`}
      data-emphasis={props.primary ? 'primary' : props.choice.emphasis}
      onClick={() => confirmNavigation(props.choice.onClick)}
      {...dataAttrs({ component: 'GameMenuChoice', ...props.choice.dataSet })}
    >
      <Artwork size={48} />
      <span class={`${styles['words']} text textHeading`}>
        {props.choice.title}
      </span>
      <span class={styles['chevron']} aria-hidden="true">
        <ChevronRightIcon size={20} />
      </span>
    </SdkButton>
  );
}

/** A centered game identity followed by every destination in the game's order. */
export function GameMenuScreen(props: GameMenuScreenProps): JSX.Element {
  const primary = createMemo(() =>
    props.choices.find((choice) => choice.emphasis !== 'quiet')
  );
  const mode = useLayoutMode();
  return (
    <EmbeddedScreen
      screenId={props.screenId}
      width="menu"
      dataSet={{ component: 'GameMenuScreen', ...props.dataSet }}
    >
      <header class={styles['hero']} data-layout="hero">
        <GameTile motif={props.motif} size={mode() === 'wide' ? 'xl' : 'lg'} />
        <h1 class="text textTitle min-w-0 break-words">{props.title}</h1>
      </header>
      <ul class={styles['grid']}>
        <For each={props.choices}>
          {(choice) => (
            <li class={styles['item']}>
              <ChoiceTile choice={choice} primary={choice === primary()} />
            </li>
          )}
        </For>
      </ul>
    </EmbeddedScreen>
  );
}
