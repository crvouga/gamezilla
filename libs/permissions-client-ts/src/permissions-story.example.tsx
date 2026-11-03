import { Button } from '@pkgs/ui-root-client-ts/button';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createJSXDecorator } from 'storybook-solidjs-vite';

/**
 * Story decorator: the screen a denial modal opens over. The modal is a
 * fixed overlay, so the canvas needs content behind it to have a size.
 */
export const withScreenBehind = createJSXDecorator((Story) => (
  <StackVertical gap="md" padding="lg" minHeight="screen">
    <P>Spaces you host appear here.</P>
    <Story />
  </StackVertical>
));

/**
 * Story decorator: a gated control in a toolbar beside an action that is
 * never gated, so `hide` shows as an absence instead of an empty canvas.
 */
export const withToolbar = createJSXDecorator((Story) => (
  <StackHorizontal gap="md" padding="lg" align="center">
    <Button title="Browse spaces" intent="neutral" variant="outline" />
    <Story />
  </StackHorizontal>
));
