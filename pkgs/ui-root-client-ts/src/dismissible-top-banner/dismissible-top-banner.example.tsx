/** @jsxImportSource solid-js */

import { Button } from '@pkgs/ui-root-client-ts/button';
import type {
  DismissibleBannerPosition,
  DismissibleBannerTone,
} from '@pkgs/ui-root-client-ts/dismissible-top-banner';
import {
  DismissibleBanner,
  DismissibleBannerPortalProvider,
} from '@pkgs/ui-root-client-ts/dismissible-top-banner';
import { SegmentedControl } from '@pkgs/ui-root-client-ts/segmented-control';
import { createSignal, For, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

const POSITION_SEGMENTS = [
  { key: 'top' as const, label: 'Top' },
  { key: 'bottom' as const, label: 'Bottom' },
];

const TONE_SEGMENTS = [
  { key: 'paper' as const, label: 'Paper' },
  { key: 'info' as const, label: 'Info' },
  { key: 'warning' as const, label: 'Warning' },
];

const SCHEMES = ['light', 'dark'] as const;

function BannerPreview(props: {
  scheme: (typeof SCHEMES)[number];
  tone: DismissibleBannerTone;
}): JSX.Element {
  return (
    <div
      class="box border border-solid border-border rounded-card overflow-hidden bg-background"
      data-theme={props.scheme}
    >
      <DismissibleBannerPortalProvider>
        <DismissibleBanner
          visible
          tone={props.tone}
          onDismiss={() => undefined}
          title="A new version is ready"
          subtitle="Reload to get the latest fixes."
          actionLabel="Reload"
          onActionClick={() => undefined}
        />
        <div class="box h-12" />
      </DismissibleBannerPortalProvider>
    </div>
  );
}

export default function DismissibleBannerExample(): JSX.Element {
  const [visible, setVisible] = createSignal(false);
  const [position, setPosition] =
    createSignal<DismissibleBannerPosition>('top');
  const [tone, setTone] = createSignal<DismissibleBannerTone>('paper');

  return (
    <DismissibleBannerPortalProvider>
      <ExampleRoot grow minHeight="md">
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
        <SegmentedControl<DismissibleBannerTone>
          segments={TONE_SEGMENTS}
          selected={tone()}
          onSelect={setTone}
        />
        <Button title="Show banner" onClick={() => setVisible(true)} />
        <For each={SCHEMES}>
          {(scheme) => <BannerPreview scheme={scheme} tone={tone()} />}
        </For>
        <DismissibleBanner
          visible={visible()}
          position={position()}
          tone={tone()}
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
