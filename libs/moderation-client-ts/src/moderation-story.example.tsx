import { shippedModerationRules } from '@libs/moderation-shared-ts/moderation-rules';
import { createJSXDecorator } from 'storybook-solidjs-vite';
import { ModerationProvider } from './moderation-context';

/**
 * Story decorator: the moderation rules the app ships with. Moderation is
 * shipped policy, not I/O, so presentational views may judge names with it.
 */
export const withShippedModeration = createJSXDecorator((Story) => (
  <ModerationProvider rules={shippedModerationRules()}>
    <Story />
  </ModerationProvider>
));
