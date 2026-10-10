import { Trans } from '@lingui/solid/macro';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import type { JSX } from 'solid-js';
import styles from './game-ui.module.css';

export function GameSearchState(props: {
  title: JSX.Element;
  description: JSX.Element;
  elapsed: JSX.Element;
  actions: JSX.Element;
}): JSX.Element {
  return (
    <section
      class={styles['search']}
      {...dataAttrs({ component: 'GameSearchState' })}
    >
      <div class="box gap-2">
        <h2 class={styles['sectionTitle']}>{props.title}</h2>
        <div class={styles['description']} role="status" aria-live="polite">
          {props.description}
        </div>
        <div class={styles['elapsed']} role="timer" aria-live="off">
          {props.elapsed} <Trans>seconds</Trans>
        </div>
      </div>
      {props.actions}
    </section>
  );
}
