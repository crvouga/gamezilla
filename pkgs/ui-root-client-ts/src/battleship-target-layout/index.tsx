import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { For, type JSX } from 'solid-js';
import styles from './battleship-target-layout.module.css';

/** Visible spatial regions over a square ocean; only the enlarged cells commit input. */
export function BattleshipRegionOverview(props: {
  overview: JSX.Element;
  region: number;
  regions: readonly string[];
  onRegion: (region: number) => void;
  testId: string;
  label: string;
  placement?: boolean;
  disabled?: boolean;
}): JSX.Element {
  return (
    <div
      data-placement={props.placement === true}
      role="group"
      aria-label={props.label}
      class={styles['navigator']}
      {...dataAttrs({ component: 'BattleshipRegionOverview' })}
    >
      <div class={styles['map']}>
        <div class={styles['overview']} inert>
          {props.overview}
        </div>
        <div class={styles['regions']} data-testid={`${props.testId}-region`}>
          <For each={props.regions}>
            {(label, index) => (
              <button
                type="button"
                class={styles['region']}
                aria-label={label}
                title={label}
                aria-pressed={props.region === index()}
                disabled={props.disabled}
                data-testid={`${props.testId}-area-${index()}`}
                onClick={() => props.onRegion(index())}
              >
                <span class={styles['regionName']}>{label}</span>
              </button>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}

/** Square spatial context stays beside the working area when its column has room. */
export function BattleshipTargetLayout(props: {
  overview: JSX.Element;
  working: JSX.Element;
  controls: JSX.Element;
}): JSX.Element {
  return (
    <div
      class={styles['layout']}
      {...dataAttrs({ component: 'BattleshipTargetLayout' })}
    >
      {props.overview}
      <div class={styles['workspace']}>
        <div class={styles['working']}>{props.working}</div>
        <div class={styles['controls']}>{props.controls}</div>
      </div>
    </div>
  );
}
