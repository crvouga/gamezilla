import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import styles from './battleship-placement-layout.module.css';

/** Keeps fleet placement controls with the working grid and a compact overview. */
export function BattleshipPlacementLayout(props: {
  controls: JSX.Element;
  working: JSX.Element;
  /** Reserved inline guidance/refusal space keeps the bow targets stationary. */
  feedback?: JSX.Element;
  overview: JSX.Element;
  overviewLabel: string;
}): JSX.Element {
  return (
    <div
      class={styles['layout']}
      {...dataAttrs({ component: 'BattleshipPlacementLayout' })}
    >
      <div class={styles['controls']}>{props.controls}</div>
      <div class={styles['feedback']}>{props.feedback}</div>
      <div class={styles['working']}>{props.working}</div>
      <div class={styles['overview']}>
        <span class="text textLabel">{props.overviewLabel}</span>
        <div inert>{props.overview}</div>
      </div>
    </div>
  );
}
