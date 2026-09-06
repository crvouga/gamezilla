import { Trans, useLingui } from '@lingui/react/macro';
import {
  Box,
  Button,
  HistoryIcon,
  MenuList,
  MenuRow,
  Text,
  useTheme,
} from '@pkgs/ui-rn';
import type { ReactNode } from 'react';

const ROW_ICON_SIZE = 18;

export function SearchRecentQueries({
  queries,
  onSelect,
  onClear,
}: {
  queries: readonly string[];
  onSelect: (query: string) => void;
  onClear: () => void;
}): ReactNode {
  const { t } = useLingui();
  const theme = useTheme();

  if (queries.length === 0) return null;

  return (
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
          onPress={onClear}
        />
      </Box>
      <MenuList>
        {queries.map((query) => (
          <MenuRow
            key={query}
            title={query}
            leading={
              <HistoryIcon
                size={ROW_ICON_SIZE}
                color={theme.colors.textSecondary}
              />
            }
            onPress={() => onSelect(query)}
          />
        ))}
      </MenuList>
    </Box>
  );
}
