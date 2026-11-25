import { definePrimitive } from '@ui-sdk/core';
import { createParts } from '@ui-sdk/solid/primitive';

type RowOptions = { onActivate?: (() => void) | undefined };

function availability(options: RowOptions) {
  return { disabled: options.onActivate === undefined };
}

const actionRow = definePrimitive({
  name: 'table-row',
  options: { onActivate: 'callback' },
  state: availability,
  sync: availability,
  api: (context) => ({
    activateRow: () => context.options().onActivate?.(),
  }),
  slots: (slot) => ({
    root: slot({
      press: ({ api }) => api.activateRow(),
      on: {
        keydown: (event, { api, el }) => {
          if (
            event.target !== el ||
            (event.key !== 'Enter' && event.key !== ' ')
          )
            return;
          event.preventDefault();
          api.activateRow();
        },
      },
    }),
  }),
  agent: { actions: ['activateRow'], shown: (state) => !state.disabled },
});

export const { Root: ActionRow } = createParts(actionRow, { root: 'tr' });
