/** @jsxImportSource solid-js */

import type { LocalizedString } from '@pkgs/i18n-shared-ts/localized-string';
import type { ComboboxKeyEvent } from '@pkgs/ui-root-shared-ts/combobox-key-nav';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, onMount } from 'solid-js';
import { SearchIcon } from '../icons';
import { TextInput } from '../text-input/index';

export type ComboboxSearchProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: LocalizedString;
  listboxId: string;
  activeDescendantId: string | undefined;
  onKeyDown: (event: ComboboxKeyEvent) => void;
  dataSet?: ComponentDataSet | undefined;
  /** Move focus into the field on mount. Default `true`. */
  /** Focus the field on mount. Default `true`. */
  focusOnMount?: boolean | undefined;
};

/**
 * Search field inside the {@link Combobox} surface. Owns focus when the
 * surface opens and reports keyboard navigation to the controller; the
 * highlighted option is announced through `aria-activedescendant`.
 */
export function ComboboxSearch(props: ComboboxSearchProps): JSX.Element {
  let inputEl: HTMLInputElement | HTMLTextAreaElement | undefined;
  onMount(() => {
    if (props.focusOnMount ?? true) inputEl?.focus();
  });
  return (
    <div class="box shrink-0 pb-2">
      <TextInput
        ref={(el) => {
          inputEl = el;
        }}
        type="search"
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        aria-label={props.placeholder}
        aria-controls={props.listboxId}
        aria-activedescendant={props.activeDescendantId}
        aria-autocomplete="list"
        autocorrect="off"
        autocapitalize="none"
        startAdornment={<SearchIcon size={18} />}
        onKeyDown={(ev) => props.onKeyDown(ev)}
        dataSet={{ component: 'ComboboxSearch', ...props.dataSet }}
      />
    </div>
  );
}
