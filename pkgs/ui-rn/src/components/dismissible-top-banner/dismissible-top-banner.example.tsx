import { useState } from 'react';

import { Button } from '../button';
import { ExampleRoot } from '../explorer/example-root';
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
    <ExampleRoot sx={{ flex: 1, minHeight: 360 }}>
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
      <DismissibleBanner
        visible={visible}
        position={position}
        onDismiss={() => setVisible(false)}
        title="Something needs your attention"
        subtitle="Optional supporting line."
        actionLabel="Primary action"
        onActionPress={() => {}}
      />
    </ExampleRoot>
  );
}
