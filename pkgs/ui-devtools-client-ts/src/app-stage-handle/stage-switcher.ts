import { type ChangeDetails, definePrimitive, dispatch } from '@ui-sdk/core';
import { createParts } from '@ui-sdk/solid/primitive';

export type StagePosition = {
  readonly side: 'left' | 'right';
  readonly down: number;
};

type SwitcherOptions = {
  readonly side: StagePosition['side'];
  readonly percentFromTop: number;
  readonly onMove: (position: StagePosition) => void;
  readonly onPress: (value: undefined, details: ChangeDetails<'press'>) => void;
};

function position(options: SwitcherOptions) {
  return { side: options.side, percentFromTop: options.percentFromTop };
}

const switcher = definePrimitive({
  name: 'stage-switcher',
  options: {
    side: 'string',
    percentFromTop: 'number',
    onMove: 'callback',
    onPress: 'callback',
  },
  controlled: ['side', 'percentFromTop'],
  state: position,
  sync: position,
  api: (context) => ({
    press(event?: Event) {
      dispatch(context, 'onPress', undefined, {
        reason: 'press',
        ...(event && { event }),
      });
    },
    moveToEdge(side: unknown, percentFromTop: unknown) {
      if (side !== 'left' && side !== 'right')
        throw new Error('Choose the left or right edge.');
      if (
        typeof percentFromTop !== 'number' ||
        !Number.isFinite(percentFromTop) ||
        percentFromTop < 0 ||
        percentFromTop > 100
      )
        throw new Error(
          'Give the position from the top as a percentage from 0 to 100.'
        );
      context.options().onMove({ side, down: percentFromTop / 100 });
    },
  }),
  slots: (slot) => ({
    root: slot({ press: ({ api }, event) => api.press(event) }),
  }),
  agent: { actions: ['press', 'moveToEdge'] },
});

export const { Root: StageSwitcher } = createParts(switcher, {
  root: 'button',
});
