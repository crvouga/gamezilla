import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createUniqueId, For, type JSX, Show } from 'solid-js';
import styles from './battleship-target-layout.module.css';

/** Visible spatial regions over a square ocean; only the enlarged cells commit input. */
export function BattleshipRegionOverview(props: {
  overview: JSX.Element;
  heading?: string;
  region: number;
  regions: readonly string[];
  /** Public outcomes in each region, available without opening its detail grid. */
  descriptions?: readonly string[];
  onRegion: (region: number) => void;
  testId: string;
  label: string;
  placement?: boolean;
  disabled?: boolean;
}): JSX.Element {
  const descriptionId = createUniqueId();
  return (
    <div
      data-placement={props.placement === true}
      role="group"
      aria-label={props.label}
      class={styles['navigator']}
      {...dataAttrs({ component: 'BattleshipRegionOverview' })}
    >
      <Show when={props.heading}>
        {(heading) => <span class="text textCaption">{heading()}</span>}
      </Show>
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
                aria-describedby={
                  props.descriptions?.[index()]
                    ? `${descriptionId}-${index()}`
                    : undefined
                }
                title={label}
                aria-pressed={props.region === index()}
                disabled={props.disabled}
                data-testid={`${props.testId}-area-${index()}`}
                onClick={() => props.onRegion(index())}
              >
                <span class={styles['regionName']}>{label}</span>
                <span
                  id={`${descriptionId}-${index()}`}
                  class={styles['regionName']}
                >
                  {props.descriptions?.[index()]}
                </span>
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
