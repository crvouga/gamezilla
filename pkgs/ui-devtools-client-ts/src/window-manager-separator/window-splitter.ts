import { createChange, definePrimitive } from '@ui-sdk/core';
import { createParts } from '@ui-sdk/solid/primitive';

type SplitterOptions = {
  value: number;
  min: number;
  max: number;
  onValueChange: (value: number) => void;
};

function dimensions(options: SplitterOptions) {
  return { value: options.value, min: options.min, max: options.max };
}

const splitter = definePrimitive({
  name: 'window-splitter',
  options: {
    value: 'number',
    min: 'number',
    max: 'number',
    onValueChange: 'callback',
  },
  controlled: ['value'],
  state: dimensions,
  sync: dimensions,
  api: (context) => {
    const change = createChange(context);
    return {
      setValue(value: number) {
        const { min, max } = context.options();
        if (Number.isFinite(value) && value >= min && value <= max)
          change('value', value, { reason: 'resize' });
      },
    };
  },
  slots: (slot) => ({
    root: slot({
      attrs: (state) => ({
        role: 'separator',
        tabindex: 0,
        'aria-valuemin': state.min,
        'aria-valuemax': state.max,
        'aria-valuenow': state.value,
      }),
    }),
  }),
  agent: { actions: ['setValue'] },
});

export const { Root: WindowSplitter } = createParts(splitter, { root: 'div' });
