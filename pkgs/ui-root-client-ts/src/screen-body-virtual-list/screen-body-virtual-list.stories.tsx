import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ContentScreen } from '../content-screen/index';
import { P } from '../text/index';
import { ScreenBodyVirtualList } from './index';
export default {
  title: 'Templates/Virtual collection',
  component: ScreenBodyVirtualList,
  tags: ['autodocs'],
} satisfies Meta<typeof ScreenBodyVirtualList>;
export const Populated: StoryObj = {
  render: () => (
    <ContentScreen
      screenId="virtual-collection"
      breadcrumbs={[{ name: 'Players' }]}
    >
      <ScreenBodyVirtualList
        items={Array.from({ length: 100 }, (_, n) => `Player ${n + 1}`)}
        keyExtractor={(item) => item}
        renderItem={(item) => <P>{item}</P>}
      />
    </ContentScreen>
  ),
};
export const Empty: StoryObj = {
  render: () => (
    <ContentScreen screenId="virtual-empty" breadcrumbs={[{ name: 'Players' }]}>
      <ScreenBodyVirtualList
        items={[]}
        keyExtractor={String}
        renderItem={String}
        empty={<P>No players yet</P>}
      />
    </ContentScreen>
  ),
};
