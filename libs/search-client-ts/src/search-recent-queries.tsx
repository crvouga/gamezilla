import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { H2 } from '@pkgs/ui-root-client-ts/heading';
import { HistoryIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuList } from '@pkgs/ui-root-client-ts/menu-list';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
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
      <StackVertical gap="xs">
        <StackHorizontal align="center" justify="between">
          <H2 size="label" tone="secondary">
            <Trans>Recent</Trans>
          </H2>
          <Button
            title={t`Clear`}
            intent="neutral"
            variant="ghost"
            size="sm"
            onClick={props.onClear}
          />
        </StackHorizontal>
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
      </StackVertical>
    </Show>
  );
}
