import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { createElement } from 'react';
import { Pressable, Text, View } from 'react-native';

import { createRenderedAppFromRntl } from './renderer-rntl';

describe('createRenderedAppFromRntl getText', () => {
  it('skips opacity-0 / aria-hidden width-lock spacers', () => {
    const result = render(
      createElement(
        Pressable,
        { testID: 'save' },
        createElement(
          View,
          null,
          createElement(
            View,
            {
              accessibilityElementsHidden: true,
              importantForAccessibility: 'no-hide-descendants',
              style: { opacity: 0 },
            },
            createElement(Text, null, 'Save')
          ),
          createElement(
            View,
            { style: { position: 'absolute' } },
            createElement(Text, null, 'Saved')
          )
        )
      )
    );
    const app = createRenderedAppFromRntl(result);
    const node = app.query('save');
    expect(node).not.toBeNull();
    expect(app.getText(node!)).toBe('Saved');
  });
});
