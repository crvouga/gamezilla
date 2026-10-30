import type { LocalizedString } from '@pkgs/i18n-shared-ts/localized-string';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import { TextInput } from '../text-input/index';

export type FilterBarProps = {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly label: LocalizedString;
  readonly placeholder?: LocalizedString;
  readonly children?: JSX.Element;
  readonly dataSet?: ComponentDataSet;
};

/** Persistent search label and caller-composed filters that reflow with available width. */
export function FilterBar(props: FilterBarProps): JSX.Element {
  return (
    <div
      class="box gap-3"
      {...dataAttrs({ component: 'FilterBar', ...props.dataSet })}
    >
      <TextInput
        type="search"
        value={props.value}
        onChangeText={props.onChange}
        label={props.label}
        aria-label={props.label}
        placeholder={props.placeholder}
      />
      <div class="box flex-row flex-wrap items-center gap-3">
        {props.children}
      </div>
    </div>
  );
}
