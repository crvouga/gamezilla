import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { P, Strong, Text } from './index';
import Example from './text.example';

const meta = {
  id: 'primitives-text',
  title: 'Atoms/Text',
  component: P,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};

/** A one-line clamp establishes a box even when the host inherits inline type. */
export const SingleLine: StoryObj = {
  render: () => (
    <StackVertical width="full" maxWidth="form">
      <Text lines={1} testId="clamped-text">
        {'a_really_long_username_that_keeps_going_and_going'.repeat(8)}
      </Text>
      <P>
        <Text variant="inherit" lines={1} testId="clamped-inherited-text">
          {'a_really_long_username_that_keeps_going_and_going'.repeat(8)}
        </Text>
      </P>
      <P>
        <Strong lines={1} testId="clamped-strong">
          {'a_really_long_username_that_keeps_going_and_going'.repeat(8)}
        </Strong>
      </P>
      <P>
        <Text variant="inherit" testId="unclamped-inline-text">
          Inline stays inline
        </Text>
      </P>
    </StackVertical>
  ),
};
