/** @jsxImportSource solid-js */
/**
 * Search field inside the {@link Combobox} surface. Owns focus when the
 * surface opens and reports keyboard navigation to the controller; the
 * highlighted option is announced through `aria-activedescendant`.
 */

import type { LocalizedString } from '@pkgs/i18n/localized-string';
import { type JSX, onMount } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { SearchIcon } from '../icons';
import { TextInput } from '../text-input';
import type { ComboboxKeyEvent } from './combobox-key-nav';

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

export function ComboboxSearch(props: ComboboxSearchProps): JSX.Element {
  let inputEl: HTMLInputElement | HTMLTextAreaElement | undefined;
  onMount(() => {
    if (props.focusOnMount ?? true) inputEl?.focus();
  });
  return (
    <Box sx={{ pb: 2 }}>
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
    </Box>
  );
}
