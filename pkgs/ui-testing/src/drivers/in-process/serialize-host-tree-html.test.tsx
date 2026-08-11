import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { createElement } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { serializeHostTreeHtml } from './serialize-host-tree-html';

describe('serializeHostTreeHtml', () => {
  it('maps RN hosts to HTML with test ids, labels, and styles', () => {
    const result = render(
      createElement(
        View,
        {
          testID: 'root',
          style: { padding: 8, backgroundColor: '#fff' },
        },
        createElement(Text, { accessibilityRole: 'header' }, 'Hello'),
        createElement(TextInput, {
          testID: 'email',
          accessibilityLabel: 'Email',
          value: 'ada@example.com',
          placeholder: 'Email',
        }),
        createElement(
          Pressable,
          {
            testID: 'submit',
            accessibilityRole: 'button',
            accessibilityLabel: 'Submit',
          },
          createElement(Text, null, 'Submit')
        )
      )
    );

    const html = serializeHostTreeHtml(result.toJSON());
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('data-testid="root"');
    expect(html).toContain('data-testid="email"');
    expect(html).toContain('aria-label="Email"');
    expect(html).toContain('value="ada@example.com"');
    expect(html).toContain('Hello');
    expect(html).toContain('Submit');
    expect(html).toContain('padding:8px');
    expect(html).toContain('background-color:#fff');
    expect(html).toContain('data-component="View"');
    expect(html).toContain('<button');
    expect(html).toContain('<input');
    expect(html).toContain('display:flex');
  });

  it('expands RN padding/margin shorthands into real CSS', () => {
    const result = render(
      createElement(View, {
        testID: 'box',
        style: {
          paddingHorizontal: 12,
          paddingVertical: 8,
          marginHorizontal: 4,
          backgroundColor: 'hsla(0, 0%, 98%, 1)',
        },
      })
    );

    const html = serializeHostTreeHtml(result.toJSON());
    expect(html).toContain('padding-left:12px');
    expect(html).toContain('padding-right:12px');
    expect(html).toContain('padding-top:8px');
    expect(html).toContain('padding-bottom:8px');
    expect(html).toContain('margin-left:4px');
    expect(html).toContain('margin-right:4px');
    expect(html).not.toContain('padding-horizontal');
    expect(html).not.toContain('padding-vertical');
    expect(html).not.toContain('margin-horizontal');
  });

  it('rewrites Expo font families and injects Google Fonts', () => {
    const result = render(
      createElement(
        Text,
        { style: { fontFamily: 'Nunito_600SemiBold', fontSize: 16 } },
        'Branded'
      )
    );

    const html = serializeHostTreeHtml(result.toJSON());
    expect(html).toContain('font-family:Nunito');
    expect(html).toContain('font-weight:600');
    expect(html).not.toContain('Nunito_600SemiBold');
    expect(html).toContain('fonts.googleapis.com/css2?family=Nunito');
  });
});
