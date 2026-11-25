import { registerUiAgentTools } from '@pkgs/ui-root-client-ts/render-application';
import { StoryProductShell } from './storybook-shell.example';

/** Product composition is injected; the UI framework does not depend on product libs. */
export const parameters = { productShell: StoryProductShell };

export const beforeAll = registerUiAgentTools;
