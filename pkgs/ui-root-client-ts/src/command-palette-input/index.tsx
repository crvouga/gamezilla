/** @jsxImportSource @solidjs/web */

import type { LocalizedString } from '@pkgs/i18n-shared-ts/localized-string';
import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { onSettled, untrack } from 'solid-js';
import { SearchIcon } from '../icons';
import { moveFocus } from '../move-focus';
import { TextInput } from '../text-input/index';

export type CommandPaletteInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  onKeyDown: (event: KeyboardEvent) => void;
  editable: boolean;
  listboxId: string;
  activeDescendantId: string | undefined;
  placeholder?: LocalizedString | undefined;
  /** Focus the field on mount. Default `true`. */
  focusOnMount?: boolean | undefined;
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `CommandPaletteInput` -- the palette search field. Exposed as
 * `role="combobox"` controlling the result listbox; the keyboard-selected row
 * is announced through `aria-activedescendant`.
 */
export function CommandPaletteInput(
  props: CommandPaletteInputProps
): JSX.Element {
  const { t } = useLingui();
  let inputEl: HTMLInputElement | HTMLTextAreaElement | undefined;
  // A mount-time option: what it says when the field mounts is what counts.
  const focusOnMount = untrack(() => props.focusOnMount ?? true);
  onSettled(() => {
    if (focusOnMount) moveFocus(inputEl);
  });
  return (
    <TextInput
      ref={(el) => {
        inputEl = el;
      }}
      value={props.value}
      onChangeText={props.onChangeText}
      onKeyDown={props.onKeyDown}
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
      spellcheck="false"
      startAdornment={<SearchIcon size={18} color="textSecondary" />}
      dataSet={{ component: 'CommandPaletteInput', ...props.dataSet }}
    />
  );
}
