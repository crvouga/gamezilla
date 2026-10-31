import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { EmbeddedScreen } from '../embedded-screen/index';
import styles from '../game-ui.module.css';
import { createScreenSlot } from '../screen-slot';

/**
 * A game inside its host's chrome. The host's one top bar carries the back
 * control and the space; the game names itself once in the body and then
 * gets out of the way of the board. Never a second bar.
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
      title={props.title}
      subtitle={props.subtitle}
      width="full"
      dataSet={{ ...props.dataSet, component: 'GameScreen' }}
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
  const stage = createScreenSlot(() => props.children);
  const aside = createScreenSlot(() => props.aside);
  return (
    <Show when={stage.present() || aside.present()}>
      <div
        class={styles['layout']}
        data-has-aside={aside.present()}
        {...dataAttrs({ component: 'GameLayout' })}
      >
        <div class={styles['stage']}>{stage.content()}</div>
        <Show when={aside.present()}>
          <div class={styles['rail']}>{aside.content()}</div>
        </Show>
      </div>
    </Show>
  );
}
