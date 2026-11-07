import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { For, type JSX } from 'solid-js';
import styles from './battleship-target-layout.module.css';

/** A whole-field map with coarse two-row regions above a comfortable aim grid. */
export function BattleshipTargetLayout(props: {
  overview: JSX.Element;
  working: JSX.Element;
  controls: JSX.Element;
  precise: boolean;
  region: number;
  regions: readonly string[];
  onRegion: (region: number) => void;
  testId: string;
}): JSX.Element {
  return (
    <div
      class={styles['layout']}
      {...dataAttrs({ component: 'BattleshipTargetLayout' })}
    >
      <div class={styles['map']}>
        <div class={styles['overview']}>{props.overview}</div>
        <div
          class={styles['regions']}
          hidden={!props.precise}
          data-testid={`${props.testId}-region`}
        >
          <For each={props.regions}>
            {(label, index) => (
              <button
                type="button"
                class={styles['region']}
                aria-label={label}
                aria-pressed={props.region === index()}
                data-testid={`${props.testId}-area-${index()}`}
                onClick={() => props.onRegion(index())}
              >
                <span>{label.split('–')[0]}</span>
                <span>{label.split('–')[1]}</span>
              </button>
            )}
          </For>
        </div>
      </div>
      <div class={styles['controls']}>{props.controls}</div>
      <div class={styles['working']}>{props.working}</div>
    </div>
  );
}
