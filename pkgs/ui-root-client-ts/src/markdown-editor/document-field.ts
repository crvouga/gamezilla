import { createChange, definePrimitive } from '@ui-sdk/core';
import { createParts } from '@ui-sdk/solid/primitive';

type DocumentOptions = {
  value: string;
  disabled: boolean;
  onValueChange: (value: string) => void;
};

const documentField = definePrimitive({
  name: 'markdown-editor',
  options: { value: 'string', disabled: 'boolean', onValueChange: 'callback' },
  controlled: ['value'],
  state: (options: DocumentOptions) => ({
    value: options.value,
    disabled: options.disabled,
  }),
  sync: ({ value, disabled }) => ({ value, disabled }),
  api: (context) => {
    const change = createChange(context);
    return {
      setValue(value: unknown) {
        if (typeof value === 'string' && !context.options().disabled)
          change('value', value, { reason: 'imperative' });
      },
    };
  },
  agent: { actions: ['setValue'] },
  slots: (slot) => ({ root: slot({}) }),
});

export const { Root: DocumentField } = createParts(documentField, { root: 'div' });
