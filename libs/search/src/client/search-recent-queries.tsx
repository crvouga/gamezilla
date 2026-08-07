import { Trans, useLingui } from '@lingui/react/macro';
import { Box, Button, Pressable, Text } from '@pkgs/ui';
import type { ReactNode } from 'react';

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

  if (queries.length === 0) return null;

  return (
    <Box sx={{ gap: 1 }}>
      <Box
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text variant="bodyBold" label={<Trans>Recent searches</Trans>} />
        <Button
          title={t`Clear`}
          intent="neutral"
          variant="ghost"
          onPress={onClear}
        />
      </Box>
      {queries.map((query) => (
        <Pressable key={query} onPress={() => onSelect(query)}>
          <Text variant="body" label={query} />
        </Pressable>
      ))}
    </Box>
  );
}
