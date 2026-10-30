import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { OverlayPortal, OverlayPortalProvider } from '../overlay-portal/index';
import { P } from '../text/index';
import { ComposeProviders } from './index';
export default {
  title: 'Patterns/Provider composition',
  component: ComposeProviders,
  subcomponents: { OverlayPortal },
  tags: ['autodocs'],
} satisfies Meta;
export const Overlay: StoryObj = {
  render: () => (
    <ComposeProviders
      providers={[
        (props) => (
          <OverlayPortalProvider>{props.children}</OverlayPortalProvider>
        ),
      ]}
    >
      <P>App content</P>
      <OverlayPortal>
        <P>Overlay content</P>
      </OverlayPortal>
    </ComposeProviders>
  ),
};
