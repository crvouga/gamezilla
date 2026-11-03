import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import {
  createJSXDecorator,
  type Meta,
  type StoryObj,
} from 'storybook-solidjs-vite';
import { BootLoadingShell } from './boot-loading-shell';

/** The shell fills the viewport and pins its indicator there; give it one. */
const withViewport = createJSXDecorator((Story) => (
  <StackVertical minHeight="screen">
    <Story />
  </StackVertical>
));

const meta = {
  id: 'screens-shell-boot-loading',
  title: 'Screens/Shell/Boot loading',
  component: BootLoadingShell,
  tags: ['autodocs'],
  decorators: [withViewport],
  parameters: { appRouter: true },
} satisfies Meta<typeof BootLoadingShell>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Identity binding or the local database opening: one centered indicator. */
export const Loading: Story = {};
