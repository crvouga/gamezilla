import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { radioGroup } from '@ui-sdk/core/radio';
import { usePrimitive } from '@ui-sdk/solid/primitive';
import { createUniqueId, For, Show } from 'solid-js';
import styles from '../game-setup-panel/game-setup-panel.module.css';

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
  disabled?: boolean;
}): JSX.Element {
  const name = createUniqueId();
  const group = usePrimitive(radioGroup, () => ({
    name,
    disabled: props.disabled === true,
    value: props.value,
    onValueChange: (next) => {
      if (next !== null) props.onChange(next);
    },
  }));
  return (
    <fieldset
      {...group.slot('group')}
      aria-labelledby={name}
      class={styles['choices']}
      disabled={props.disabled}
      {...dataAttrs({ component: 'GameChoiceGrid' })}
    >
      <legend id={name} class={`${styles['legend']} text textFootnote`}>
        {props.label}
      </legend>
      <div class={styles['choiceGrid']}>
        <For each={props.choices}>
          {(choice) => (
            <label
              class={styles['choice']}
              data-selected={String(props.value === choice.value)}
            >
              <input
                {...group.slot('root', () => ({ value: choice.value }))}
                class={styles['choiceInput']}
                type="radio"
                name={name}
                value={choice.value}
                checked={props.value === choice.value}
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
