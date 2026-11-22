import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming';

addons.setConfig({
  theme: create({ base: 'light', brandTitle: 'Design system' }),
  enableShortcuts: true,
  // Day-to-day work is on screens and templates; the building blocks stay a
  // click away. A reader's own expand and collapse choices still win.
  sidebar: { collapsedRoots: ['organisms', 'molecules', 'atoms'] },
});
