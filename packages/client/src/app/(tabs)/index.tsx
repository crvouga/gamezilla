import { useMemo, useState } from 'react';
import {
  Box,
  ScrollView,
  SegmentedControl,
  Text,
} from '@gamezilla/shared/ui';

import { ConstrainedContent } from '@/ui/constrained-content';
import { ScreenHeader } from '@/ui/screen-header';
import { SpaceCard } from '@/features/spaces/space-card';
import {
  filterSpaces,
  MOCK_SPACES,
} from '@/features/spaces/mock-spaces';
import type { SpaceFilter } from '@/features/spaces/types';

export default function SpacesScreen() {
  const [filter, setFilter] = useState<SpaceFilter>('all');

  const spaces = useMemo(
    () => filterSpaces(MOCK_SPACES, filter),
    [filter],
  );

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenHeader
        title="Spaces"
        subtitle="Rooms to play with friends"
        showAccountMenu
      />
      <ConstrainedContent>
        <Box sx={{ px: 4, pt: 2, pb: 2 }}>
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
            paddingHorizontal: 16,
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
      </ConstrainedContent>
    </Box>
  );
}
