/** @jsxImportSource solid-js */

import { DismissibleBannerPortalProvider } from '@pkgs/ui-root-client-ts/dismissible-top-banner';
import { createJSXDecorator } from 'storybook-solidjs-vite';

/**
 * Story decorator: the in-flow banner host the app root mounts once, so a
 * shell banner portals into its top slot as it does in the app.
 */
export const withBannerHost = createJSXDecorator((Story) => (
  <DismissibleBannerPortalProvider>
    <Story />
  </DismissibleBannerPortalProvider>
));
