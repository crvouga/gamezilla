/** @jsxImportSource solid-js */
/**
 * `CommandPaletteInput` -- the palette search field. Exposed as
 * `role="combobox"` controlling the result listbox; the keyboard-selected row
 * is announced through `aria-activedescendant`.
 */

import { useLingui } from '@lingui/solid/macro';
import type { LocalizedString } from '@pkgs/i18n/localized-string';
import { type JSX, onMount } from 'solid-js';
import { SearchIcon } from '../icons';
import { TextInput } from '../text-input';

export type CommandPaletteInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  editable: boolean;
  listboxId: string;
  activeDescendantId: string | undefined;
  placeholder?: LocalizedString | undefined;
  /** Focus the field on mount. Default `true`. */
  focusOnMount?: boolean | undefined;
};

export function CommandPaletteInput(
  props: CommandPaletteInputProps
): JSX.Element {
  const { t } = useLingui();
  let inputEl: HTMLInputElement | HTMLTextAreaElement | undefined;
  onMount(() => {
    if (props.focusOnMount ?? true) inputEl?.focus();
  });
  return (
    <TextInput
      ref={(el) => {
        inputEl = el;
      }}
      value={props.value}
      onChangeText={props.onChangeText}
      disabled={!props.editable}
      placeholder={props.placeholder ?? t`Type a command or search…`}
      aria-label={props.placeholder ?? t`Type a command or search…`}
      role="combobox"
      aria-expanded="true"
      aria-autocomplete="list"
      aria-controls={props.listboxId}
      aria-activedescendant={props.activeDescendantId}
      autocomplete="off"
      autocapitalize="none"
      spellcheck={false}
      startAdornment={<SearchIcon size={18} color="textSecondary" />}
      dataSet={{ component: 'CommandPaletteInput' }}
    />
  );
}
