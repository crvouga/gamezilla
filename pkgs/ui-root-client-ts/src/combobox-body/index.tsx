/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import type { LocalizedString } from '@pkgs/i18n-shared-ts/localized-string';
import type { ComboboxKeyEvent } from '@pkgs/ui-root-shared-ts/combobox-key-nav';
import type {
  ComboboxOption,
  ComboboxRenderOption,
  ComboboxValue,
} from '@pkgs/ui-root-shared-ts/combobox-types';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import type { VirtualListViewport } from '@pkgs/ui-root-shared-ts/virtual-list-types';
import { type JSX, Show } from 'solid-js';
import { ComboboxList, comboboxOptionId } from '../combobox-list/index';
import { ComboboxSearch } from '../combobox-search/index';
import { ErrorState } from '../error-state/index';
import { LoadingState } from '../loading-state/index';
import { ModalButton, ModalFooter } from '../modal-parts/index';

export type ComboboxBodyProps<T extends ComboboxValue> = {
  query: string;
  setQuery: (query: string) => void;
  searchPlaceholder: LocalizedString;
  options: readonly ComboboxOption<T>[];
  value: T | null;
  values: ReadonlySet<T> | undefined;
  highlightedIndex: number;
  listboxId: string;
  listboxLabel: string | undefined;
  multiple: boolean;
  onPick: (next: T) => void;
  onDone: () => void;
  onSearchKeyDown: (event: ComboboxKeyEvent) => void;
  searchDataSet: ComponentDataSet | undefined;
  /** Identifier for the multi-select `Done` footer button. */
  doneDataSet: ComponentDataSet | undefined;
  renderOption: ComboboxRenderOption<T> | undefined;
  loading: boolean;
  error: JSX.Element | undefined;
  emptyMessage: JSX.Element | undefined;
  viewport: VirtualListViewport | undefined;
};

function ComboboxEmpty(props: {
  message: JSX.Element | undefined;
}): JSX.Element {
  return (
    <Show when={props.message !== undefined && props.message !== null}>
      <div class="box py-2" role="status">
        <p class="text textCaption text-text-secondary text-center">
          {props.message}
        </p>
      </div>
    </Show>
  );
}

function ComboboxOptions<T extends ComboboxValue>(
  props: ComboboxBodyProps<T>
): JSX.Element {
  const { t } = useLingui();
  const hasError = (): boolean =>
    props.error !== undefined && props.error !== null && props.error !== '';
  return (
    <Show
      when={!props.loading}
      fallback={<LoadingState size="sm" variant="compact" />}
    >
      <div class="box gap-2 flex-1 min-h-0 shrink">
        <Show when={hasError()}>
          <ErrorState
            variant="compact"
            title={t`Failed to load`}
            body={props.error}
          />
        </Show>
        <Show
          when={props.options.length > 0}
          fallback={<ComboboxEmpty message={props.emptyMessage} />}
        >
          <ComboboxList
            options={props.options}
            value={props.value}
            values={props.values}
            highlightedIndex={props.highlightedIndex}
            listboxId={props.listboxId}
            multiple={props.multiple}
            label={props.listboxLabel}
            onPick={props.onPick}
            renderOption={props.renderOption}
            viewport={props.viewport}
          />
        </Show>
      </div>
    </Show>
  );
}

/**
 * Surface body for {@link Combobox}: search field, async status (loading /
 * error), the option listbox or empty message, and a `Done` footer for
 * multi-select.
 */
export function ComboboxBody<T extends ComboboxValue>(
  props: ComboboxBodyProps<T>
): JSX.Element {
  const { t } = useLingui();
  const activeDescendantId = (): string | undefined =>
    props.options.length > 0
      ? comboboxOptionId(props.listboxId, props.highlightedIndex)
      : undefined;
  return (
    <div class="box gap-2 flex-1 min-h-0 shrink overflow-hidden">
      <ComboboxSearch
        value={props.query}
        onChangeText={props.setQuery}
        placeholder={props.searchPlaceholder}
        listboxId={props.listboxId}
        activeDescendantId={activeDescendantId()}
        onKeyDown={props.onSearchKeyDown}
        dataSet={props.searchDataSet}
      />
      <ComboboxOptions {...props} />
      <Show when={props.multiple}>
        <ModalFooter>
          <ModalButton
            label={t`Done`}
            onClick={() => props.onDone()}
            dataSet={props.doneDataSet}
          />
        </ModalFooter>
      </Show>
    </div>
  );
}
