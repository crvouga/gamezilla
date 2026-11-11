/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import type { LocalizedString } from '@pkgs/i18n-shared-ts/localized-string';
import {
  type ComponentDataSet,
  dataAttrs,
} from '@pkgs/ui-root-shared-ts/component-id';
import { For, type JSX, Show } from 'solid-js';
import { Button } from '../button/index';
import { ChipGroup } from '../chip-group/index';
import type { IconComponent } from '../create-icon/index';
import { SearchIcon } from '../icons';
import { Spinner } from '../spinner/index';
import { TextInput } from '../text-input/index';

/** The search box at the head of a table. */
export type DataTableSearch = {
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** Names the box for assistive tech ("Find Synthetic Users"). */
  readonly label: LocalizedString;
  /** What can be searched for ("Name, activity, region or worker"). */
  readonly placeholder?: LocalizedString | undefined;
  /** Rendered as the input's `data-testid`. */
  readonly testId?: string | undefined;
};

export type DataTableFilterOption<K extends string> = {
  readonly key: K;
  readonly label: string;
  /** Rendered as the chip's `data-testid`. */
  readonly testId?: string | undefined;
};

/** One choice of which rows to show, as chips beside the search. */
export type DataTableFilter<K extends string> = {
  /** Names the chips for assistive tech ("Show who is online now"). */
  readonly label: string;
  readonly options: readonly DataTableFilterOption<K>[];
  readonly selected: K;
  readonly onSelect: (key: K) => void;
  /** Rendered as the chip group's `data-testid`. */
  readonly testId?: string | undefined;
};

/**
 * An action on the whole collection ("Pause every Synthetic User"). It
 * opens its own confirmation or form surface; the table only offers it.
 */
export type DataTableAction = {
  readonly label: string;
  readonly icon?: IconComponent | undefined;
  readonly onPress: () => void;
  /** Rendered as the button's `data-testid`. */
  readonly testId?: string | undefined;
};

/** Moving between pages of a collection the server pages. */
export type DataTablePaging = {
  /** Where the reader is ("Page 2"). */
  readonly label: string;
  /** Leaves out to disable Previous (on the first page). */
  readonly onPrevious?: (() => void) | undefined;
  /** Leaves out to disable Next (on the last page). */
  readonly onNext?: (() => void) | undefined;
};

/** A `data-testid`, when one is given. */
function testIdSet(testId: string | undefined): ComponentDataSet | undefined {
  return testId === undefined ? undefined : { testid: testId };
}

/** The count line and the collection's actions, above the toolbar. */
export function DataTableHeader(props: {
  count: string | undefined;
  refreshing: boolean;
  actions: readonly DataTableAction[];
}): JSX.Element {
  const { t } = useLingui();
  return (
    <Show
      when={
        props.count !== undefined ||
        props.refreshing ||
        props.actions.length > 0
      }
    >
      <div class="box flex-row flex-wrap items-center justify-between gap-ui-sm">
        <div class="box flex-row items-center gap-ui-sm min-h-8">
          <Show when={props.count}>
            {(count) => (
              <p class="text textCaption" aria-live="polite">
                {count()}
              </p>
            )}
          </Show>
          <Show when={props.refreshing}>
            <Spinner size="sm" label={t`Updating…`} />
          </Show>
        </div>
        <div class="box flex-row flex-wrap items-center gap-ui-sm">
          <For each={props.actions}>
            {(action) => (
              <Button
                title={action.label}
                icon={action.icon}
                intent="neutral"
                variant="outline"
                size="sm"
                onClick={() => action.onPress()}
                dataSet={testIdSet(action.testId)}
              />
            )}
          </For>
        </div>
      </div>
    </Show>
  );
}

/** Search and filter chips: stacked on a phone, side by side when wide. */
export function DataTableToolbar<K extends string>(props: {
  search: DataTableSearch | undefined;
  filter: DataTableFilter<K> | undefined;
}): JSX.Element {
  return (
    <Show when={props.search !== undefined || props.filter !== undefined}>
      <div
        class="box gap-ui-sm md:flex-row md:items-center md:gap-ui-md"
        {...dataAttrs({ component: 'DataTableToolbar' })}
      >
        <Show when={props.search}>
          {(search) => (
            <div class="box md:flex-1 min-w-0">
              <TextInput
                type="search"
                value={search().value}
                onChangeText={(value) => search().onChange(value)}
                aria-label={search().label}
                placeholder={search().placeholder}
                startAdornment={<SearchIcon size={18} color="icon" />}
                dataSet={testIdSet(search().testId)}
              />
            </div>
          )}
        </Show>
        <Show when={props.filter}>
          {(filter) => (
            <ChipGroup
              aria-label={filter().label}
              options={filter().options.map((option) => ({
                key: option.key,
                label: option.label,
                testid: option.testId,
              }))}
              selected={filter().selected}
              onSelect={(key) => filter().onSelect(key)}
              dataSet={testIdSet(filter().testId)}
            />
          )}
        </Show>
      </div>
    </Show>
  );
}

/** Where the reader is among the pages, with Previous and Next. */
export function DataTablePager(props: {
  paging: DataTablePaging | undefined;
  disabled: boolean;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <Show when={props.paging}>
      {(paging) => (
        <nav
          class="box flex-row items-center justify-between gap-ui-sm"
          aria-label={t`Pages`}
          {...dataAttrs({ component: 'DataTablePager' })}
        >
          <p class="text textCaption">{paging().label}</p>
          <div class="box flex-row items-center gap-ui-sm">
            <Button
              title={t`Previous`}
              intent="neutral"
              variant="outline"
              size="sm"
              disabled={props.disabled || paging().onPrevious === undefined}
              onClick={() => paging().onPrevious?.()}
            />
            <Button
              title={t`Next`}
              intent="neutral"
              variant="outline"
              size="sm"
              disabled={props.disabled || paging().onNext === undefined}
              onClick={() => paging().onNext?.()}
            />
          </div>
        </nav>
      )}
    </Show>
  );
}
