/** @jsxImportSource solid-js */
import { createSignal, type JSX } from 'solid-js';
import { Button } from '../button';
import { ExampleRoot } from '../explorer/example-root';
import { SegmentedControl } from '../segmented-control';
import { Text } from '../text';
import {
  DismissibleBanner,
  DismissibleBannerPortalProvider,
  type DismissibleBannerPosition,
} from './dismissible-top-banner';

const POSITION_SEGMENTS = [
  { key: 'top' as const, label: 'Top' },
  { key: 'bottom' as const, label: 'Bottom' },
];

export default function DismissibleBannerExample(): JSX.Element {
  const [visible, setVisible] = createSignal(false);
  const [position, setPosition] =
    createSignal<DismissibleBannerPosition>('top');

  return (
    <DismissibleBannerPortalProvider>
      <ExampleRoot sx={{ flex: 1, minHeight: 360 }}>
        <Text
          variant="caption"
          label="Banner UI portals to DismissibleBannerPortalProvider (mount once at the app root). This example mounts its own provider so the banner stays inside the preview. Position is a prop — like a toaster region."
        />
        <SegmentedControl<DismissibleBannerPosition>
          segments={POSITION_SEGMENTS}
          selected={position()}
          onSelect={setPosition}
        />
        <Button title="Show banner" onClick={() => setVisible(true)} />
        <DismissibleBanner
          visible={visible()}
          position={position()}
          onDismiss={() => setVisible(false)}
          title="Something needs your attention"
          subtitle="Optional supporting line."
          actionLabel="Primary action"
          onActionClick={() => undefined}
        />
      </ExampleRoot>
    </DismissibleBannerPortalProvider>
  );
}
