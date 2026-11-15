import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createUniqueId, For, type JSX, Show } from 'solid-js';
import styles from '../game-ui.module.css';
import grid from './game-choice-grid.module.css';

export type GameChoice = {
  value: string;
  title: JSX.Element;
  detail?: JSX.Element;
  dataSet?: ComponentDataSet;
};

/** Native radio semantics include arrow keys, one tab stop and labelled options; Enter picks too. */
export function GameChoiceGrid(props: {
  label: JSX.Element;
  choices: readonly GameChoice[];
  value: string;
  onChange: (value: string) => void;
  /**
   * A choice pressed (a click, a tap, Space or Enter), even the one
   * already chosen; arrow keys only change the choice. For a list that is left
   * once something is picked.
   */
  onPress?: ((value: string) => void) | undefined;
  disabled?: boolean;
  /** Choices in a row: three (the default), or four for short choices. */
  columns?: 3 | 4 | undefined;
}): JSX.Element {
  const name = createUniqueId();
  return (
    <fieldset
      class={styles['choices']}
      disabled={props.disabled}
      {...dataAttrs({ component: 'GameChoiceGrid' })}
    >
      <legend class={`${styles['meta']} text textFootnote`}>
        {props.label}
      </legend>
      <div
        class={styles['choiceGrid']}
        classList={{ [grid['four'] ?? '']: props.columns === 4 }}
      >
        <For each={props.choices}>
          {(choice) => (
            <label
              class={styles['choice']}
              data-selected={props.value === choice.value}
            >
              <input
                class={styles['choiceInput']}
                type="radio"
                name={name}
                value={choice.value}
                checked={props.value === choice.value}
                onChange={() => props.onChange(choice.value)}
                onClick={() => props.onPress?.(choice.value)}
                onKeyDown={(event) => {
                  // Enter picks the focused choice, as a press does.
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  if (props.value !== choice.value)
                    props.onChange(choice.value);
                  props.onPress?.(choice.value);
                }}
                {...dataAttrs({ component: 'GameChoice', ...choice.dataSet })}
              />
              <span class={`${styles['choiceTitle']} text textLabel`}>
                {choice.title}
              </span>
              <Show when={choice.detail}>
                <span class={`${styles['choiceDetail']} text textFootnote`}>
                  {choice.detail}
                </span>
              </Show>
            </label>
          )}
        </For>
      </div>
    </fieldset>
  );
}
