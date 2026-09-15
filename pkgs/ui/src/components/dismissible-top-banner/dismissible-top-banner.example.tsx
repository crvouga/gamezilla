/** @jsxImportSource solid-js */
import { createSignal, type JSX } from 'solid-js';
import { Button } from '../button';
import { ExampleRoot } from '../explorer/example-root';
import { SegmentedControl } from '../segmented-control';
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
      <ExampleRoot class="flex-1 min-h-[360px]">
        <p class="text textCaption">
          {
            'Banner UI portals into in-flow top/bottom slots. Product apps host the portal on AppFrame so the sheet full-bleeds while content stays on the max-width column. This example mounts its own provider so the banner stays inside the preview.'
          }
        </p>
        <SegmentedControl<DismissibleBannerPosition>
          segments={POSITION_SEGMENTS}
          selected={position()}
          onSelect={setPosition}
        />
        <Button title="Show banner" onClick={() => setVisible(true)} />
        <DismissibleBanner
          visible={visible()}
          position={position()}
          tone="paper"
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
