import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { SegmentedControl } from '../segmented-control/index';
import styles from './paired-panels.module.css';

export type PairedPanelsProps<K extends string> = {
  /** The name of the pair, and of the switch that chooses between them. */
  readonly label: string;
  readonly testId: string;
  /** The two panels' keys, in reading order; the switch's segments are `${testId}-${key}`. */
  readonly keys: readonly [K, K];
  readonly labels: Readonly<Record<K, string>>;
  /** The panel shown when only one fits. */
  readonly selected: K;
  readonly onSelect: (key: K) => void;
  readonly first: JSX.Element;
  readonly second: JSX.Element;
  /**
   * Each panel is named by its label above it while both show side by
   * side; behind the switch the switch alone names the panel shown, so a
   * panel never repeats the segment chosen just above it.
   */
  readonly titled?: boolean | undefined;
};

function PanelTitle(props: {
  readonly titled: boolean | undefined;
  readonly label: string;
}): JSX.Element {
  return (
    <Show when={props.titled === true}>
      <h3
        class={`${styles['title']} text textLabel`}
        {...dataAttrs({ component: 'PairedPanelsTitle' })}
      >
        {props.label}
      </h3>
    </Show>
  );
}

/**
 * Two related panels: side by side where both fit, one at a time behind a
 * segmented switch where they do not. Both stay mounted either way, so
 * switching keeps each panel's state and focus.
 */
export function PairedPanels<K extends string>(
  props: PairedPanelsProps<K>
): JSX.Element {
  const shown = (index: 0 | 1): boolean => props.keys[index] === props.selected;
  return (
    <div
      class={styles['frame']}
      {...dataAttrs({ component: 'PairedPanels' })}
      data-testid={props.testId}
      data-selected={props.selected}
    >
      <div class={styles['pair']}>
        <div class={styles['switch']}>
          <SegmentedControl
            segments={props.keys.map((key) => ({
              key,
              label: props.labels[key],
            }))}
            selected={props.selected}
            onSelect={props.onSelect}
            aria-label={props.label}
            dataSet={{ testid: props.testId }}
          />
        </div>
        <section
          class={styles['panel']}
          aria-label={props.labels[props.keys[0]]}
          data-panel={props.keys[0]}
          data-shown={String(shown(0))}
        >
          <PanelTitle
            titled={props.titled}
            label={props.labels[props.keys[0]]}
          />
          {props.first}
        </section>
        <section
          class={styles['panel']}
          aria-label={props.labels[props.keys[1]]}
          data-panel={props.keys[1]}
          data-shown={String(shown(1))}
        >
          <PanelTitle
            titled={props.titled}
            label={props.labels[props.keys[1]]}
          />
          {props.second}
        </section>
      </div>
    </div>
  );
}
