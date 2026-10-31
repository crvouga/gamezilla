/** @jsxImportSource solid-js */

import { Button } from '@pkgs/ui-root-client-ts/button';
import type { DismissibleBannerTone } from '@pkgs/ui-root-client-ts/dismissible-top-banner';
import {
  DismissibleBanner,
  DismissibleBannerPortalProvider,
} from '@pkgs/ui-root-client-ts/dismissible-top-banner';
import { createSignal, For, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

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

  return (
    <DismissibleBannerPortalProvider>
      <ExampleRoot grow minHeight="md">
        <p class="text textCaption">
          {
            'Banner UI portals into in-flow top/bottom slots. Product apps host the portal on AppFrame so the sheet full-bleeds while content stays on the max-width column. This example mounts its own provider so the banner stays inside the preview.'
          }
        </p>
        <Button title="Show banner" onClick={() => setVisible(true)} />
        <For each={SCHEMES}>
          {(scheme) => <BannerPreview scheme={scheme} tone="paper" />}
        </For>
        <DismissibleBanner
          visible={visible()}
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
