import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import { createUniqueId, type JSX, Show } from 'solid-js';
import styles from './game-ui.module.css';

export function GameSection(props: {
  title: JSX.Element;
  description?: JSX.Element;
  children: JSX.Element;
  footer?: JSX.Element;
  dataSet?: ComponentDataSet;
}): JSX.Element {
  const id = createUniqueId();
  return (
    <section
      class={styles['section']}
      aria-labelledby={id}
      {...dataAttrs({ component: 'GameSection', ...props.dataSet })}
    >
      <div class="box gap-1">
        <h2 id={id} class={styles['sectionTitle']}>
          {props.title}
        </h2>
        <Show when={props.description}>
          <p class={styles['description']}>{props.description}</p>
        </Show>
      </div>
      {props.children}
      <Show when={props.footer}>
        <div class={styles['sectionFooter']}>{props.footer}</div>
      </Show>
    </section>
  );
}

export function GameActions(props: { children: JSX.Element }): JSX.Element {
  return (
    <div class={styles['actions']} {...dataAttrs({ component: 'GameActions' })}>
      {props.children}
    </div>
  );
}
