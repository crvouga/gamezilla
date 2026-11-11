/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { For, type JSX, Show } from 'solid-js';
import { useScreenFocus } from '../screen-focus/index';
import { createScreenSlot } from '../screen-slot';
import { ScrollView } from '../scroll-view/index';
import { useLayoutMode } from '../use-layout-mode';
import styles from './game-lobby.module.css';
import { GameModeArt } from './mode-art';

/** One thing agreed about the game, as a tile on the mode card. */
export type GameModeFact = {
  id: string;
  /** What the fact is (`Clock`). */
  label: JSX.Element;
  /** What it is set to (`10 min + 5 sec`). */
  value: JSX.Element;
  testId?: string | undefined;
};

export type GameModeCardProps = {
  /** The mode, above the game's name (`Custom game`, `Ranked match`). */
  eyebrow: JSX.Element;
  /** The game's name: the screen's `h1`. */
  title: JSX.Element;
  /** One or two plain sentences on what is played and how it is won. */
  summary?: JSX.Element | undefined;
  /** What is agreed, at a glance: up to three tiles in one row. */
  facts?: readonly GameModeFact[] | undefined;
  /**
   * The game's own board at its start, as the card's picture: it shows what
   * is played and takes nothing pressed. A phone gives it the room the
   * lobby has to spare; a long roster leaves it out.
   */
  art?: JSX.Element | undefined;
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `GameModeCard` -- what is about to be played, at the head of a lobby or a
 * search: the mode over the game's name, a line on the game, and what is
 * agreed (players, clock, rated or not) as a row of tiles. It only reads;
 * nothing on it is pressed.
 *
 * @example
 * ```tsx
 * <GameModeCard
 *   eyebrow="Custom game"
 *   title="Connect Four"
 *   summary="Line up four discs in a row before your opponent does."
 *   facts={[{ id: 'clock', label: 'Clock', value: 'Untimed' }]}
 * />
 * ```
 */
export function GameModeCard(props: GameModeCardProps): JSX.Element {
  const summary = createScreenSlot(() => props.summary);
  return (
    <header
      class={styles['mode']}
      {...dataAttrs({ component: 'GameModeCard', ...props.dataSet })}
    >
      <GameModeArt art={props.art} />
      <div class={styles['modeWords']}>
        <p class={`text textCaption ${styles['eyebrow']}`}>{props.eyebrow}</p>
        <h1 class="text textTitle min-w-0 max-w-full break-words">
          {props.title}
        </h1>
        <Show when={summary.present()}>
          <p class={`text textBody ${styles['summary']}`}>
            {summary.content()}
          </p>
        </Show>
      </div>
      <Show when={(props.facts?.length ?? 0) > 0}>
        <dl class={styles['facts']}>
          <For each={props.facts}>
            {(fact) => (
              <div class={styles['fact']} data-fact={fact.id}>
                <dt class="text textCaption">{fact.label}</dt>
                <dd
                  class={`text textLabel ${styles['factValue']}`}
                  data-testid={fact.testId}
                >
                  {fact.value}
                </dd>
              </div>
            )}
          </For>
        </dl>
      </Show>
    </header>
  );
}

export type GameLobbyDockProps = {
  /** Where the lobby stands, in one line (`Ready to start.`). */
  status?: JSX.Element | undefined;
  /** The one thing to do next, then at most one quiet alternative. */
  children: JSX.Element;
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `GameLobbyDock` -- the lobby's command, pinned to the foot of the screen
 * (`GameLobbyScreen`'s `dock`): where the lobby stands, then the one thing
 * to do next as a full-width command under the thumb.
 */
export function GameLobbyDock(props: GameLobbyDockProps): JSX.Element {
  const status = createScreenSlot(() => props.status);
  return (
    <div
      class={styles['dockColumn']}
      {...dataAttrs({ component: 'GameLobbyDock', ...props.dataSet })}
    >
      <Show when={status.present()}>
        <div class={styles['dockStatus']}>{status.content()}</div>
      </Show>
      <div class={styles['dockActions']}>{props.children}</div>
    </div>
  );
}

export type GameLobbyScreenProps = {
  /** Stable screen identifier rendered as `data-screen`. */
  screenId: string;
  /** The mode card, then the lobby's sections. They scroll under the dock. */
  children: JSX.Element;
  /** A `GameLobbyDock`: stays at the foot of the screen. */
  dock?: JSX.Element | undefined;
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `GameLobbyScreen` -- a game's lobby inside a host's chrome: one column at
 * a menu's measure that scrolls, over a dock that never does. The command
 * that moves the lobby on (get ready, start, find an opponent) is always in
 * the same place, however long the roster above it grows. On a wide host
 * the dock closes the column instead, right under the lobby, so the
 * command is never a pane's height away from what it acts on.
 *
 * @example
 * ```tsx
 * <GameLobbyScreen
 *   screenId="custom-game-lobby"
 *   dock={<GameLobbyDock status="Ready to start.">…</GameLobbyDock>}
 * >
 *   <GameModeCard … />
 *   <MenuSection title="Players">…</MenuSection>
 * </GameLobbyScreen>
 * ```
 */
export function GameLobbyScreen(props: GameLobbyScreenProps): JSX.Element {
  const mode = useLayoutMode();
  const dock = createScreenSlot(() => props.dock);
  let root: HTMLDivElement | undefined;
  useScreenFocus(
    () => root,
    () => props.screenId
  );
  return (
    <div
      ref={(el) => {
        root = el;
      }}
      class={styles['screen']}
      data-wide={mode() === 'wide'}
      {...dataAttrs({
        component: 'GameLobbyScreen',
        ...props.dataSet,
        screen: props.screenId,
      })}
    >
      <ScrollView
        grow
        self="stretch"
        width="full"
        paddingX={mode() === 'wide' ? undefined : 'lg'}
        paddingTop="sm"
        paddingBottom="xl"
        gap="lg"
        measure="menu"
        measureAlign="center"
      >
        {props.children}
      </ScrollView>
      <Show when={dock.present()}>
        <footer class={styles['dock']} data-inset={mode() !== 'wide'}>
          {dock.content()}
        </footer>
      </Show>
    </div>
  );
}
