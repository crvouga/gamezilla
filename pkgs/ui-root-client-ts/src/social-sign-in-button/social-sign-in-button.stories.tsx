import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SocialSignInButton } from './index';
import Example from './social-sign-in-button.example';

const meta = {
  id: 'components-inputs-socialsigninbutton',
  title: 'Molecules/SocialSignInButton',
  component: SocialSignInButton,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
