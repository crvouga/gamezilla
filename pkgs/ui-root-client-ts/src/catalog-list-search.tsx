/** @jsxImportSource solid-js */
/**
 * Fixed search field for {@link CatalogList}.
 */

import type { LocalizedString } from '@pkgs/i18n-shared-ts/localized-string';
import type { JSX } from 'solid-js';

import { SearchIcon } from './icons';
import { TextInput } from './text-input';

export type CatalogListSearchProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: LocalizedString;
};

export function CatalogListSearch(props: CatalogListSearchProps): JSX.Element {
  return (
    <TextInput
      type="search"
      value={props.value}
      onChangeText={props.onChangeText}
      placeholder={props.placeholder}
      aria-label={props.placeholder}
      autocorrect="off"
      autocapitalize="none"
      startAdornment={<SearchIcon size={18} />}
    />
  );
}
