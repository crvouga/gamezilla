import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SNAPSHOT, userDetail } from './synthetic-population.example';
import { SyntheticUserInspectorScreenView } from './synthetic-user-inspector-screen-view';

const meta = {
  id: 'screens-admin-synthetic-user-inspector',
  title: 'Screens/Admin/Synthetic user inspector',
  component: SyntheticUserInspectorScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['user', 'snapshot', 'denial'] },
  },
  args: {
    user: userDetail(),
    snapshot: SNAPSHOT,
    loading: false,
    failed: false,
    onRefresh: fn(),
    onInspect: fn(async () => undefined),
  },
} satisfies Meta<typeof SyntheticUserInspectorScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A current capture: route, controls, recent actions and sanitized markup. */
export const Captured: Story = {};

/** No capture for this session yet: only the request. */
export const NotCaptured: Story = { args: { snapshot: null } };

/** A later read failed: the capture stays, with a retry above it. */
export const Failed: Story = { args: { failed: true } };

/** A person without inspect: the denial replaces the screen. */
export const Denied: Story = {
  args: {
    user: undefined,
    snapshot: null,
    denial: {
      icon: KeyRoundIcon,
      title: 'Not available',
      dataSet: {
        testid: 'synthetic-population-inspect-denied',
        reason: 'not_granted',
      },
    },
  },
};
