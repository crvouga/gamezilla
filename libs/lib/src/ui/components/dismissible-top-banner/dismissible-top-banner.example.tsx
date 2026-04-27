import { useState } from 'react';

import { Box } from '../box';
import { Button } from '../button';
import { SegmentedControl } from '../segmented-control';
import { Text } from '../text';
import {
  DismissibleBanner,
  type DismissibleBannerPosition,
} from './dismissible-top-banner';

export default function DismissibleBannerExample() {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<DismissibleBannerPosition>('top');

  return (
    <Box sx={{ flex: 1, minHeight: 360 }}>
      <Box sx={{ flex: 1, p: 4, gap: 4 }}>
        <Text variant="heading" label="DismissibleBanner" />
        <Text
          variant="caption"
          label="Banner UI portals to DismissibleBannerPortalProvider (mount once at app root, inside AppThemeRoot). The client app already does this. Turning visible on without that provider hits assert (fatal crash path). Position is a prop — like a toaster region."
        />
        <SegmentedControl<DismissibleBannerPosition>
          segments={[
            { key: 'top', label: 'Top' },
            { key: 'bottom', label: 'Bottom' },
          ]}
          selected={position}
          onSelect={setPosition}
        />
        <Button title="Show banner" onPress={() => setVisible(true)} />
      </Box>
      <DismissibleBanner
        visible={visible}
        position={position}
        onDismiss={() => setVisible(false)}
        title="Something needs your attention"
        subtitle="Optional supporting line."
        actionLabel="Primary action"
        onActionPress={() => {}}
      />
    </Box>
  );
}
