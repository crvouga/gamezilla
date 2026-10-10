import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import { type JSX, Show } from 'solid-js';
import styles from './game-ui.module.css';

export function GameHeader(props: {
  context: JSX.Element;
  title: JSX.Element;
  description: JSX.Element;
  detail?: JSX.Element;
}): JSX.Element {
  return (
    <header
      class={styles['header']}
      {...dataAttrs({ component: 'GameHeader' })}
    >
      <div class="box min-w-0 gap-1">
        <h1 class="text textHeading">{props.title}</h1>
        <p class="text textFootnote">{props.context}</p>
        <p class="text textBody text-text-secondary">{props.description}</p>
      </div>
      <Show when={props.detail}>
        <div class={styles['headerDetail']}>{props.detail}</div>
      </Show>
    </header>
  );
}
