import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { EmbeddedScreen } from '../embedded-screen/index';
import styles from '../game-ui.module.css';
import { ScreenIntro } from '../screen-intro/index';
import { createScreenSlot } from '../screen-slot';

/**
 * A game inside its host's chrome. The host's one top bar carries the back
 * control and the space; the game names itself once in the body and then
 * gets out of the way of the board. Never a second bar.
 *
 * Every game screen is one column centered in the frame, its title block
 * at the column's start edge: as wide as the board and its rail together
 * when there is a rail (`GameLayout`), as wide as a game menu when there is
 * no board beside a rail (a search, a choice), and the whole frame for
 * anything else. The title therefore lines up with what is under it.
 */
export function GameScreen(props: {
  screenId: string;
  title: JSX.Element;
  subtitle?: JSX.Element | undefined;
  dataSet?: ComponentDataSet | undefined;
  children: JSX.Element;
}): JSX.Element {
  return (
    <EmbeddedScreen
      screenId={props.screenId}
      width="full"
      dataSet={{ ...props.dataSet, component: 'GameScreen' }}
    >
      <div class={styles['column']} {...dataAttrs({ component: 'GameColumn' })}>
        <ScreenIntro title={props.title} subtitle={props.subtitle} />
        {props.children}
      </div>
    </EmbeddedScreen>
  );
}

/**
 * The board column and its supporting rail. On phones everything stacks in
 * reading order: setup, the stage, then the rail. On wide screens the stage
 * is one board-wide column (the board, the turn and the play actions right
 * under it) with setup and the rail beside it in one narrow column, so
 * neither pushes the board down. An empty slot takes no room, and toggling
 * the rail or setup never remounts the play surface.
 */
export function GameLayout(props: {
  children: JSX.Element;
  /** Setup, invitation or waiting controls; beside the stage when wide. */
  setup?: JSX.Element | undefined;
  aside?: JSX.Element | undefined;
}): JSX.Element {
  const stage = createScreenSlot(() => props.children);
  const setup = createScreenSlot(() => props.setup);
  const aside = createScreenSlot(() => props.aside);
  return (
    <Show when={stage.present() || setup.present() || aside.present()}>
      <div
        class={styles['layout']}
        data-has-stage={stage.present()}
        data-has-setup={setup.present()}
        data-has-aside={aside.present()}
        {...dataAttrs({ component: 'GameLayout' })}
      >
        <Show when={setup.present()}>
          <div class={styles['setup']}>{setup.content()}</div>
        </Show>
        <div class={styles['stage']}>{stage.content()}</div>
        <Show when={aside.present()}>
          <div class={styles['rail']}>{aside.content()}</div>
        </Show>
      </div>
    </Show>
  );
}
