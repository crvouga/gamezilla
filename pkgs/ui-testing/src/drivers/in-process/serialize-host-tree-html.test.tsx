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
    expect(html).toContain('position:relative');
  });

  it('uses a dark expo-reset shell with consistent body fonts', () => {
    const html = serializeHostTreeHtml({
      type: 'View',
      props: {},
      children: null,
    });
    expect(html).toContain('color-scheme:dark');
    expect(html).toContain('name="color-scheme" content="dark"');
    expect(html).toContain('background:hsla(240, 5%, 4%, 1)');
    expect(html).toContain('color:hsla(0, 0%, 98%, 1)');
    expect(html).toContain('overflow:hidden');
    expect(html).toContain('user-select:none');
    expect(html).toContain('user-select:text');
    expect(html).toContain('font-family:Nunito');
    expect(html).toContain('fonts.googleapis.com/css2?family=Nunito');
    expect(html).toContain(
      '.rn-root{display:flex;flex-direction:column;flex:1;min-height:100%;height:100%;position:relative;box-sizing:border-box;}'
    );
    expect(html).toContain(
      'input,textarea,button,span{font:inherit;color:inherit;}'
    );
  });

  it('keeps absoluteFill children inside positioned view hosts', () => {
    const html = serializeHostTreeHtml({
      type: 'View',
      props: {
        testID: 'button',
        style: { overflow: 'hidden', minHeight: 40 },
        dataSet: {
          component: 'Button',
          css: 'overflow:hidden;min-height:40px',
        },
      },
      children: [
        {
          type: 'View',
          props: {
            dataSet: {
              component: 'GradientBox',
              css: 'position:absolute;top:0;right:0;bottom:0;left:0;background-image:linear-gradient(180deg,hsla(221,83%,53%,1),hsla(221,83%,53%,1))',
            },
          },
          children: null,
        },
      ],
    });
    expect(html).toMatch(
      /data-testid="button"[^>]*style="[^"]*position:relative/
    );
    expect(html).toContain('data-component="GradientBox"');
    expect(html).toContain('position:absolute;top:0;right:0;bottom:0;left:0');
    expect(html).toContain('linear-gradient');
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

  it('prefers captured dataSet.css and dataSet.component over RN style', () => {
    const html = serializeHostTreeHtml({
      type: 'View',
      props: {
        testID: 'box',
        style: { padding: 8, backgroundColor: 'red' },
        dataSet: {
          component: 'Box',
          css: 'padding:8px;line-height:18px;background-color:hsla(0,0%,98%,1)',
        },
      },
      children: null,
    });
    expect(html).toContain('data-component="Box"');
    expect(html).toContain('line-height:18px');
    expect(html).toContain('background-color:hsla(0,0%,98%,1)');
    expect(html).not.toContain('background-color:red');
    expect(html).not.toContain('data-component="View"');
  });

  it('emits lineHeight as px in the RN fallback path', () => {
    const result = render(
      createElement(Text, { style: { fontSize: 12, lineHeight: 18 } }, 'Hi')
    );
    const html = serializeHostTreeHtml(result.toJSON());
    expect(html).toContain('line-height:18px');
    expect(html).not.toMatch(/line-height:18;/);
  });

  it('maps RCTScrollView to overflow:auto', () => {
    const html = serializeHostTreeHtml({
      type: 'RCTScrollView',
      props: { style: { flex: 1 } },
      children: [
        {
          type: 'View',
          props: { style: { padding: 8 } },
          children: null,
        },
      ],
    });
    expect(html).toContain('overflow:auto');
    expect(html).toContain('data-component="RCTScrollView"');
    expect(html).toContain('padding:8px');
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
