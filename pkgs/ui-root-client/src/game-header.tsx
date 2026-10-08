import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import { type JSX, Show } from 'solid-js';
import styles from './game-ui.module.css';
import { Gamepad2Icon } from './icons';

export function GameHeader(props: {
  eyebrow: JSX.Element;
  title: JSX.Element;
  description: JSX.Element;
  detail?: JSX.Element;
}): JSX.Element {
  return (
    <header
      class={styles['header']}
      {...dataAttrs({ component: 'GameHeader' })}
    >
      <span class={styles['emblem']} aria-hidden="true">
        <Gamepad2Icon size={28} />
      </span>
      <div class="box min-w-0 gap-1">
        <p class={styles['eyebrow']}>{props.eyebrow}</p>
        <h1 class={styles['title']}>{props.title}</h1>
        <p class={styles['description']}>{props.description}</p>
      </div>
      <Show when={props.detail}>
        <div class={styles['headerDetail']}>{props.detail}</div>
      </Show>
    </header>
  );
}
