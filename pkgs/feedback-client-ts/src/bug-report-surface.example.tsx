import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { ScrollView } from '@pkgs/ui-root-client-ts/scroll-view';
import { createJSXDecorator } from 'storybook-solidjs-vite';

/**
 * Story decorator: the bug report opens over whatever the app was showing,
 * so the story has a screen of the app, in its shell, behind its sheet or
 * dialog. Needs `parameters: { appRouter: true }` for the shell.
 */
export const withAppBehind = createJSXDecorator((Story) => (
  <ScrollView grow tone="background" flushEdge={false}>
    <EmptyState
      title="The app"
      body="Whatever was on screen when the bug report opened stays behind it."
    />
    <Story />
  </ScrollView>
));
