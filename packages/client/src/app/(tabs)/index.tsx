import { useMemo, useState } from 'react';
import {
  Box,
  ScrollView,
  SegmentedControl,
  Text,
  ScreenBase,
  useBreakpoint,
} from '@gamezilla/shared/ui';

import { SpaceCard } from '@/features/spaces/space-card';
import {
  filterSpaces,
  MOCK_SPACES,
} from '@/features/spaces/mock-spaces';
import type { SpaceFilter } from '@/features/spaces/types';
import { useAccountActions } from '@/ui/use-account-actions';

export default function SpacesScreen() {
  const [filter, setFilter] = useState<SpaceFilter>('all');
  const accountActions = useAccountActions();
  const isMobile = useBreakpoint() === 'mobile';

  const spaces = useMemo(
    () => filterSpaces(MOCK_SPACES, filter),
    [filter],
  );

  return (
    <ScreenBase
      breadcrumbs={[
        {
          name: 'Spaces',
          subtitle: 'Rooms to play with friends',
        },
      ]}
      actions={isMobile ? accountActions : []}
      content={({ sx }) => (
        <Box style={sx}>
          <Box sx={{ pt: 2, pb: 2 }}>
            <SegmentedControl<SpaceFilter>
              segments={[
                { key: 'all', label: 'All' },
                { key: 'live', label: 'Live' },
                { key: 'mine', label: 'Mine' },
              ]}
              selected={filter}
              onSelect={setFilter}
            />
          </Box>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingBottom: 24,
              gap: 12,
            }}
          >
            {spaces.length === 0 ? (
              <Box sx={{ py: 8, alignItems: 'center' }}>
                <Text
                  variant="body"
                  sx={{ color: 'textSecondary' }}
                  label="No spaces match this filter."
                />
              </Box>
            ) : (
              spaces.map((space) => (
                <Box key={space.id} sx={{ mb: 3 }}>
                  <SpaceCard space={space} />
                </Box>
              ))
            )}
          </ScrollView>
        </Box>
      )}
    />
  );
}
