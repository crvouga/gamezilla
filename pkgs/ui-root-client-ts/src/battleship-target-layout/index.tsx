import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createUniqueId, For, type JSX, Show } from 'solid-js';
import styles from './battleship-target-layout.module.css';

/** Visible spatial regions over a square ocean; only the enlarged cells commit input. */
export function BattleshipRegionOverview(props: {
  overview: JSX.Element;
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

/**
 * Square spatial context stays beside the working area when its column has
 * room. The optional header spans the whole layout directly above the map:
 * its instruction first, then anything that reads the map (its key).
 */
export function BattleshipTargetLayout(props: {
  header?: JSX.Element;
  overview: JSX.Element;
  working: JSX.Element;
  controls: JSX.Element;
}): JSX.Element {
  return (
    <div
      class={styles['layout']}
      {...dataAttrs({ component: 'BattleshipTargetLayout' })}
    >
      <Show when={props.header}>
        <div class={styles['header']}>{props.header}</div>
      </Show>
      {props.overview}
      <div class={styles['workspace']}>
        <div class={styles['working']}>{props.working}</div>
        <div class={styles['controls']}>{props.controls}</div>
      </div>
    </div>
  );
}

/**
 * One row over a whole board: its instruction first, then whatever reads
 * the board (its key), wrapping under it where the row is narrow.
 */
export function BattleshipTargetHeader(props: {
  children: JSX.Element;
}): JSX.Element {
  return (
    <div
      class={styles['header']}
      {...dataAttrs({ component: 'BattleshipTargetHeader' })}
    >
      {props.children}
    </div>
  );
}

/**
 * A whole 10×10 board no taller than the window leaves room for: its key
 * above, Fire, the switch and the person's own seat below.
 */
export function BattleshipWholeBoard(props: {
  children: JSX.Element;
}): JSX.Element {
  return (
    <div
      class={styles['whole']}
      {...dataAttrs({ component: 'BattleshipWholeBoard' })}
    >
      {props.children}
    </div>
  );
}
