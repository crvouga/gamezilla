import { For } from 'solid-js';

export type TabOption = {
  readonly value: string;
  readonly label: string;
};

/** A segmented control. Catalog filters use this instead of a native select. */
export function TabPicker(props: {
  label: string;
  value: string;
  options: readonly TabOption[];
  onPick: (value: string) => void;
}) {
  return (
    <div class="sr-seg" role="tablist" aria-label={props.label}>
      <For each={props.options}>
        {(option) => (
          <button
            type="button"
            role="tab"
            aria-selected={props.value === option.value}
            classList={{ on: props.value === option.value }}
            onClick={() => props.onPick(option.value)}
          >
            {option.label}
          </button>
        )}
      </For>
    </div>
  );
}
