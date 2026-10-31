import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { OverlayPortal, OverlayPortalProvider } from '../overlay-portal/index';
import { P } from '../text/index';
import { ComposeProviders } from './index';
export default {
  id: 'patterns-provider-composition',
  title: 'Organisms/Patterns/Provider composition',
  component: ComposeProviders,
  subcomponents: { OverlayPortal },
  tags: ['autodocs'],
  parameters: { controls: { disable: true } },
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
