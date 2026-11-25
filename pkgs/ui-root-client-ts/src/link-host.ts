import { definePrimitive } from '@ui-sdk/core';
import { createParts } from '@ui-sdk/solid/primitive';

const link = definePrimitive({
  name: 'link',
  state: () => ({}),
  api: (context) => ({
    follow() {
      const anchor = context.element('root');
      if (anchor?.hasAttribute('href')) anchor.click();
    },
  }),
  agent: { actions: ['follow'] },
  slots: (slot) => ({ root: slot({}) }),
});

export const { Root: LinkHost } = createParts(link, { root: 'a' });
