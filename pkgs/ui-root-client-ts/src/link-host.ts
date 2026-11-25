import { definePrimitive } from '@ui-sdk/core';
import { createParts } from '@ui-sdk/solid/primitive';

function availability(options: { disabled?: boolean | undefined }) {
  return { disabled: options.disabled === true };
}

const link = definePrimitive({
  name: 'link',
  options: { disabled: 'boolean' },
  state: availability,
  sync: availability,
  api: (context) => ({
    follow() {
      const anchor = context.element('root');
      if (context.options().disabled || !anchor?.hasAttribute('href'))
        throw new Error('This link is unavailable.');
      anchor.click();
    },
  }),
  agent: { actions: ['follow'] },
  slots: (slot) => ({ root: slot({}) }),
});

export const { Root: LinkHost } = createParts(link, { root: 'a' });
