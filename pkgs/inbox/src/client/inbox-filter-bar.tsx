import { Trans } from '@lingui/react/macro';
import { Box, Pressable, Text } from '@pkgs/ui';
import type { ReactNode } from 'react';

import type { InteractionFilter } from '../shared/interaction';
import {
  INBOX_FILTER_ACTION_REQUIRED,
  INBOX_FILTER_ALL,
  INBOX_FILTER_ARCHIVED,
} from './inbox-filter-values';

type InboxFilterBarProps = {
  readonly filter: InteractionFilter;
  readonly onFilterChange: (filter: InteractionFilter) => void;
};

function FilterChip({
  active,
  label,
  onPress,
}: {
  readonly active: boolean;
  readonly label: ReactNode;
  readonly onPress: () => void;
}): ReactNode {
  return (
    <Pressable onPress={onPress}>
      <Box
        sx={{
          px: 2,
          py: 1,
          borderRadius: 999,
          backgroundColor: active ? 'brand' : 'surfaceRaised',
        }}
      >
        <Text
          variant="caption"
          label={label}
          sx={{ color: active ? 'onBrand' : 'textSecondary' }}
        />
      </Box>
    </Pressable>
  );
}

export function InboxFilterBar({
  filter,
  onFilterChange,
}: InboxFilterBarProps): ReactNode {
  return (
    <Box sx={{ flexDirection: 'row', flexWrap: 'wrap', gap: 1 }}>
      <FilterChip
        active={filter === 'all'}
        label={<Trans>All</Trans>}
        onPress={() => onFilterChange(INBOX_FILTER_ALL)}
      />
      <FilterChip
        active={filter === 'action_required'}
        label={<Trans>Action required</Trans>}
        onPress={() => onFilterChange(INBOX_FILTER_ACTION_REQUIRED)}
      />
      <FilterChip
        active={filter === 'archived'}
        label={<Trans>Archived</Trans>}
        onPress={() => onFilterChange(INBOX_FILTER_ARCHIVED)}
      />
    </Box>
  );
}
