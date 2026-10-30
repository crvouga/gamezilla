import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MarkdownContent } from './index';

const meta = {
  title: 'Components/Content/MarkdownContent',
  component: MarkdownContent,
  tags: ['autodocs'],
} satisfies Meta<typeof MarkdownContent>;
export default meta;
export const Document: StoryObj<typeof MarkdownContent> = {
  args: {
    value:
      '# Room notes\n\nA **shared** plan with _emphasis_.\n\n- First move\n- Next move\n\n[Read the rules](#rules)\n\n> Keep your work safe.',
  },
};
export const Code: StoryObj<typeof MarkdownContent> = {
  args: { value: '```ts\nconst nextMove = "e4";\n```' },
};
export const Empty: StoryObj<typeof MarkdownContent> = {
  args: { value: '' },
  render: (args) => (
    <StackVertical gap="md">
      <P>Empty document</P>
      <MarkdownContent {...args} />
    </StackVertical>
  ),
};
export const UnsafeLink: StoryObj<typeof MarkdownContent> = {
  args: { value: '[Open](javascript:alert(1))\n\n<script>alert(1)</script>' },
};
