import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ScreenMirror } from './index';
import Example, {
  LONG_MIRRORED_SCREEN,
  MIRRORED_SCREEN,
} from './screen-mirror.example';

const meta = {
  id: 'primitives-screenmirror',
  title: 'Atoms/ScreenMirror',
  component: ScreenMirror,
  tags: ['autodocs'],
  args: { title: "nightowl_88's screen", html: MIRRORED_SCREEN },
} satisfies Meta<typeof ScreenMirror>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A phone screen as its person sees it, scaled to the room it is given. */
export const Phone: Story = {};

/** A desktop-sized screen, scaled down further. */
export const Desktop: Story = { args: { device: 'desktop' } };

/** Content longer than the screen is clipped, never scrolled. */
export const LongContent: Story = { args: { html: LONG_MIRRORED_SCREEN } };

/** Representative variants side by side. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
