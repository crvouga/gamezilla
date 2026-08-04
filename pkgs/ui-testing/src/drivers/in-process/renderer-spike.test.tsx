import { describe, expect, it } from 'bun:test';
import { createElement, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { createDomRenderAdapter } from './renderer-dom';
import { by } from '../../selector/selector';

/**
 * Spike: prove react-native-web renders under Bun + happy-dom with the
 * react-native → react-native-web resolve alias from bun-preload.
 */
describe('renderer-dom spike', () => {
  it('renders react-native primitives into the DOM', async () => {
    const adapter = createDomRenderAdapter();
    const app = await adapter.render(
      createElement(
        View,
        { testID: 'root' },
        createElement(Text, null, 'Hello spike')
      )
    );

    const root = app.query(by.testId('root'));
    expect(root).not.toBeNull();
    expect(app.getText(root!)).toContain('Hello spike');
    app.unmount();
  });

  it('handles press and text input', async () => {
    const adapter = createDomRenderAdapter();
    const app = await adapter.render(createElement(SpikeCounter));

    await app.tap(app.query(by.testId('inc'))!);
    expect(app.getText(app.query(by.testId('count'))!)).toBe('1');

    await app.typeText(app.query(by.testId('name'))!, 'Ada');
    expect(app.getText(app.query(by.testId('name'))!)).toBe('Ada');
    app.unmount();
  });
});

function SpikeCounter() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('');
  return createElement(
    View,
    null,
    createElement(Text, { testID: 'count' }, String(count)),
    createElement(
      Pressable,
      { testID: 'inc', onPress: () => setCount((c) => c + 1) },
      createElement(Text, null, 'Inc')
    ),
    createElement(TextInput, {
      testID: 'name',
      value: name,
      onChangeText: setName,
      accessibilityLabel: 'Name',
    })
  );
}
