import { createChange, definePrimitive } from '@ui-sdk/core';
import { createParts } from '@ui-sdk/solid/primitive';

type SurfacePickerOptions = {
  readonly items: readonly { value: string; label: string }[];
  readonly value: string;
  readonly onValueChange: (id: string) => void;
};

function selection(options: SurfacePickerOptions) {
  return { value: options.value, items: options.items };
}

const surfacePicker = definePrimitive({
  name: 'preview-surfaces',
  options: { items: 'value', value: 'string', onValueChange: 'callback' },
  controlled: ['value'],
  state: selection,
  sync: selection,
  api: (context) => {
    const change = createChange(context);
    return {
      items: () => context.options().items,
      setValue(id: string) {
        if (!context.options().items.some((item) => item.value === id))
          throw new Error('Choose one of the listed preview surfaces.');
        change('value', id, { reason: 'item-press' });
      },
    };
  },
  slots: (slot) => ({ root: slot({ attrs: () => ({ role: 'group' }) }) }),
  agent: { actions: ['setValue'], items: (api) => api.items(), closed: true },
});

export const { Root: PreviewSurfacePicker } = createParts(surfacePicker, {
  root: 'div',
});
