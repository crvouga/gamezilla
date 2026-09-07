import { Trans, useLingui } from '@lingui/solid/macro';
import { Box, Button, HistoryIcon, MenuList, MenuRow, Text } from '@pkgs/ui';
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
      <Box sx={{ gap: 1 }}>
        <Box
          sx={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: 32,
          }}
        >
          <Text
            variant="label"
            sx={{ color: 'textSecondary' }}
            label={<Trans>Recent</Trans>}
          />
          <Button
            title={t`Clear`}
            intent="neutral"
            variant="ghost"
            size="sm"
            onClick={props.onClear}
          />
        </Box>
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
      </Box>
    </Show>
  );
}
