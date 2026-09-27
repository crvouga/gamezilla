import { Trans, useLingui } from '@lingui/solid/macro';
import { Button, HistoryIcon, MenuList, MenuRow } from '@pkgs/ui';
import { For, type JSX, Show } from 'solid-js';

const ROW_ICON_SIZE = 18;

export function SearchRecentQueries(props: {
  readonly queries: readonly string[];
  readonly onSelect: (query: string) => void;
  readonly onClear: () => void;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <Show when={props.queries.length > 0}>
      <div class="box gap-1">
        <div class="box flex-row items-center justify-between min-h-8">
          <label class="text textLabel text-text-secondary">
            {<Trans>Recent</Trans>}
          </label>
          <Button
            title={t`Clear`}
            intent="neutral"
            variant="ghost"
            size="sm"
            onClick={props.onClear}
          />
        </div>
        <MenuList>
          <For each={props.queries}>
            {(query) => (
              <MenuRow
                title={query}
                leading={
                  <HistoryIcon size={ROW_ICON_SIZE} color="textSecondary" />
                }
                onClick={() => props.onSelect(query)}
              />
            )}
          </For>
        </MenuList>
      </div>
    </Show>
  );
}
