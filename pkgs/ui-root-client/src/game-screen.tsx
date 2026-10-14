import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import { type JSX, Show } from 'solid-js';
import { EmbeddedScreen } from './embedded-screen';
import styles from './game-ui.module.css';

/**
 * A game inside its host's chrome. The host's one top bar carries the back
 * control and the space; the game names itself once in the body and then
 * gets out of the way of the board. Never a second bar.
 */
export function GameScreen(props: {
  screenId: string;
  title: JSX.Element;
  subtitle?: JSX.Element | undefined;
  children: JSX.Element;
}): JSX.Element {
  return (
    <EmbeddedScreen
      screenId={props.screenId}
      title={props.title}
      subtitle={props.subtitle}
      width="stage"
      dataSet={{ component: 'GameScreen' }}
    >
      {props.children}
    </EmbeddedScreen>
  );
}

/** A fluid stage and a supporting rail, stacked in reading order on phones. */
export function GameLayout(props: {
  children: JSX.Element;
  aside?: JSX.Element | undefined;
}): JSX.Element {
  return (
    <div
      class={styles['layout']}
      data-has-aside={!!props.aside}
      {...dataAttrs({ component: 'GameLayout' })}
    >
      <div class={styles['stage']}>{props.children}</div>
      <Show when={props.aside}>
        <div class={styles['rail']}>{props.aside}</div>
      </Show>
    </div>
  );
}
