import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createUniqueId, For, type JSX, Show } from 'solid-js';
import styles from '../game-ui.module.css';

export type GameChoice = {
  value: string;
  title: JSX.Element;
  detail?: JSX.Element;
  dataSet?: ComponentDataSet;
};

/** Native radio semantics include arrow keys, one tab stop and labelled options. */
export function GameChoiceGrid(props: {
  label: JSX.Element;
  choices: readonly GameChoice[];
  value: string;
  onChange: (value: string) => void;
  /**
   * A choice pressed (a click, a tap, or Space), even the one already
   * chosen; arrow keys only change the choice. For a list that is left
   * once something is picked.
   */
  onPress?: ((value: string) => void) | undefined;
  disabled?: boolean;
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
      <div class={styles['choiceGrid']}>
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
