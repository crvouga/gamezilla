import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import styles from './battleship-placement-layout.module.css';

/** Keeps fleet placement controls with the working grid and a legible full-fleet overview. */
export function BattleshipPlacementLayout(props: {
  controls: JSX.Element;
  working: JSX.Element;
  commands?: JSX.Element;
  /** Region selection sits immediately above placement guidance and the grid. */
  region?: JSX.Element;
  /** Reserved inline guidance/refusal space keeps the bow targets stationary. */
  feedback?: JSX.Element;
  overview: JSX.Element;
  overviewLabel: string;
  inspection?: boolean;
}): JSX.Element {
  return (
    <div
      class={styles['layout']}
      data-inspection={props.inspection === true}
      {...dataAttrs({ component: 'BattleshipPlacementLayout' })}
    >
      <div class={styles['controls']}>{props.controls}</div>
      <div class={styles['commands']}>{props.commands}</div>
      <div class={styles['region']}>{props.region}</div>
      <div class={styles['feedback']}>{props.feedback}</div>
      <div class={styles['working']}>{props.working}</div>
      <div class={styles['overview']}>
        <span class="text textLabel">{props.overviewLabel}</span>
        {props.overview}
      </div>
    </div>
  );
}
