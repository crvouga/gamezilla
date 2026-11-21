import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SpaceDetailScreenView } from './space-detail-screen-view';
import Detail, { HostOffline } from './space-detail-screen-view.stories';

/**
 * The design system's Spaces table, Host away or left row: only a guest
 * has this cell. The state is the Space screen's own story
 * (`Screens/Spaces/Space`, Host offline).
 */
const meta = {
  id: 'space-host-away-or-left',
  title: 'Space/Host away or left',
  component: SpaceDetailScreenView,
  tags: ['autodocs', 'viewport-responsive'],
  parameters: Detail.parameters,
  args: Detail.args,
  render: Detail.render,
} satisfies Meta<typeof SpaceDetailScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The host went offline: the bar says so, and the space's body stays as it was. */
export const Guest: Story = { ...HostOffline };
