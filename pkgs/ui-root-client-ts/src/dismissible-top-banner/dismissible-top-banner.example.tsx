/** @jsxImportSource @solidjs/web */

import { Button } from '@pkgs/ui-root-client-ts/button';
import {
  DismissibleBanner,
  DismissibleBannerPortalProvider,
} from '@pkgs/ui-root-client-ts/dismissible-top-banner';
import type { JSX } from '@solidjs/web';
import { createSignal } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

function BannerPreview(): JSX.Element {
  return (
    <div class="box border border-solid border-border rounded-card overflow-hidden bg-background">
      <DismissibleBannerPortalProvider>
        <DismissibleBanner
          visible
          tone="paper"
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
        <BannerPreview />
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
