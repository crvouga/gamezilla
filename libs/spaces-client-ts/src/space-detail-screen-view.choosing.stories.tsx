import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SpaceDetailScreenView } from './space-detail-screen-view';
import Detail, {
  Guest as DetailGuest,
} from './space-detail-screen-view.stories';

/**
 * The design system's Spaces table, Choosing row: the space's own screen
 * while its host picks what to play, once per role. The states are the
 * Space screen's own stories (`Screens/Spaces/Space`).
 */
const meta = {
  id: 'space-choosing',
  title: 'Space/Choosing',
  component: SpaceDetailScreenView,
  tags: ['autodocs', 'viewport-responsive'],
  parameters: Detail.parameters,
  args: Detail.args,
  render: Detail.render,
} satisfies Meta<typeof SpaceDetailScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The host picks a game from the selectable list; who is here sits under its title. */
export const Host: Story = {};

/** A guest sees the same list, told the host picks; its rows are not pressable. */
export const Guest: Story = { ...DetailGuest };
