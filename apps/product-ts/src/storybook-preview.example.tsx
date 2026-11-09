import { StoryProductShell } from './storybook-shell.example';

/** Product composition is injected; the UI framework does not depend on product libs. */
export const parameters = { productShell: StoryProductShell };
