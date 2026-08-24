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
      'html,body{width:390px;height:844px;margin:0;padding:0;overflow:hidden;position:relative;'
    );
    expect(html).toContain(
      '.rn-root{width:390px;height:844px;display:flex;flex-direction:column;flex:1;min-height:100%;box-sizing:border-box;overflow:hidden;}'
    );
    expect(html).toContain(
      'input,textarea,button,span{font:inherit;color:inherit;}'
    );
  });

  it('emits data-src from dataSet.src', () => {
    const html = serializeHostTreeHtml({
      type: 'View',
      props: {
        dataSet: {
          component: 'Button',
          src: 'pkgs/ui/src/components/button/button.tsx:42',
        },
      },
      children: null,
    });
    expect(html).toContain('data-component="Button"');
    expect(html).toContain(
      'data-src="pkgs/ui/src/components/button/button.tsx:42"'
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

  it('rewrites Platform ui-rounded to Nunito (avoids Times fallback)', () => {
    const result = render(
      createElement(
        Text,
        { style: { fontFamily: 'ui-rounded', fontSize: 18 } },
        'Spaces'
      )
    );

    const html = serializeHostTreeHtml(result.toJSON());
    expect(html).toContain('font-family:Nunito');
    expect(html).toContain('font-weight:700');
    expect(html).not.toContain('ui-rounded');
  });

  it('maps RNSVG hosts to real svg/path markup', () => {
    const html = serializeHostTreeHtml({
      type: 'RNSVGSvgView',
      props: {
        minX: 0,
        minY: 0,
        vbWidth: 24,
        vbHeight: 24,
        bbWidth: 16,
        bbHeight: 16,
        fill: null,
      },
      children: [
        {
          type: 'RNSVGGroup',
          props: {
            fill: null,
            stroke: { type: 0, payload: 0xff_ff_ff_ff },
            strokeWidth: 2,
            strokeLinecap: 1,
            strokeLinejoin: 1,
          },
          children: [
            {
              type: 'RNSVGPath',
              props: {
                d: 'M12 2L12 22',
                fill: null,
                stroke: { type: 0, payload: 0xff_00_80_ff },
                strokeWidth: 2,
              },
              children: null,
            },
          ],
        },
      ],
    });
    expect(html).toContain('<svg');
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('width="16"');
    expect(html).toContain('height="16"');
    expect(html).toContain('<g ');
    expect(html).toContain('<path ');
    expect(html).toContain('d="M12 2L12 22"');
    expect(html).toContain('fill="none"');
    expect(html).toContain('stroke="#0080ff"');
    expect(html).toContain('stroke-linecap="round"');
    expect(html).not.toMatch(/<div data-component="RNSVGPath"/);
  });

  it('maps RNSVGCircle to circle with decoded fill', () => {
    const html = serializeHostTreeHtml({
      type: 'RNSVGSvgView',
      props: {
        minX: 0,
        minY: 0,
        vbWidth: 24,
        vbHeight: 24,
        bbWidth: 24,
        bbHeight: 24,
      },
      children: [
        {
          type: 'RNSVGCircle',
          props: {
            cx: 12,
            cy: 12,
            r: 10,
            fill: { type: 0, payload: 0xff_80_80_80 },
          },
          children: null,
        },
      ],
    });
    expect(html).toContain('<circle ');
    expect(html).toContain('cx="12"');
    expect(html).toContain('cy="12"');
    expect(html).toContain('r="10"');
    expect(html).toContain('fill="#808080"');
  });

  it('maps RNSVGLine to line (not div) so Lucide icons stay valid SVG', () => {
    const html = serializeHostTreeHtml({
      type: 'RNSVGSvgView',
      props: {
        minX: 0,
        minY: 0,
        vbWidth: 24,
        vbHeight: 24,
        bbWidth: 24,
        bbHeight: 24,
        fill: null,
        stroke: { type: 0, payload: 0xff_3c_83_f6 },
        strokeWidth: 2,
      },
      children: [
        {
          type: 'RNSVGGroup',
          props: {
            fill: null,
            stroke: { type: 0, payload: 0xff_3c_83_f6 },
            strokeWidth: 2,
          },
          children: [
            {
              type: 'RNSVGLine',
              props: {
                x1: 6,
                y1: 12,
                x2: 10,
                y2: 12,
                fill: null,
                stroke: { type: 0, payload: 0xff_3c_83_f6 },
                strokeWidth: 2,
              },
              children: null,
            },
            {
              type: 'RNSVGPath',
              props: {
                d: 'M17.32 5H6.68a4 4 0 0 0-3.978 3.59',
                fill: null,
                stroke: { type: 0, payload: 0xff_3c_83_f6 },
                strokeWidth: 2,
              },
              children: null,
            },
          ],
        },
      ],
    });
    expect(html).toContain('<line ');
    expect(html).toContain('x1="6"');
    expect(html).toContain('y1="12"');
    expect(html).toContain('x2="10"');
    expect(html).toContain('y2="12"');
    expect(html).toContain('stroke="#3c83f6"');
    expect(html).toContain('<line data-component="RNSVGLine"');
    expect(html).not.toMatch(/<div data-component="RNSVGLine"/);
    expect(html).not.toMatch(/<svg[^>]*>[\s\S]*<div/);
  });

  it('maps DiceBear-like mask/rect trees without HTML divs inside svg', () => {
    const html = serializeHostTreeHtml({
      type: 'RNSVGSvgView',
      props: {
        minX: 0,
        minY: 0,
        vbWidth: 200,
        vbHeight: 200,
        bbWidth: 40,
        bbHeight: 40,
      },
      children: [
        {
          type: 'RNSVGGroup',
          props: { fill: null },
          children: [
            {
              type: 'RNSVGMask',
              props: {
                name: 'clipA',
                maskUnits: 0,
                maskContentUnits: 1,
              },
              children: [
                {
                  type: 'RNSVGRect',
                  props: {
                    x: 0,
                    y: 0,
                    width: '100%',
                    height: '100%',
                    fill: { type: 0, payload: 0xff_ff_ff_ff },
                  },
                  children: null,
                },
              ],
            },
            {
              type: 'RNSVGGroup',
              props: {
                mask: 'clipA',
                fill: { type: 0, payload: 0xff_33_66_99 },
              },
              children: [
                {
                  type: 'RNSVGRect',
                  props: {
                    x: 0,
                    y: 0,
                    width: 200,
                    height: 200,
                    fill: { type: 0, payload: 0xff_33_66_99 },
                  },
                  children: null,
                },
                {
                  type: 'RNSVGPath',
                  props: {
                    d: 'M20 28c8-13 29-13 37 0',
                    fill: { type: 0, payload: 0xff_00_00_00 },
                  },
                  children: null,
                },
              ],
            },
          ],
        },
      ],
    });
    expect(html).toContain('<mask ');
    expect(html).toContain('id="clipA"');
    expect(html).toContain('maskUnits="objectBoundingBox"');
    expect(html).toContain('<rect ');
    expect(html).toContain('width="100%"');
    expect(html).toContain('mask="url(#clipA)"');
    expect(html).not.toMatch(/<div data-component="RNSVGMask"/);
    expect(html).not.toMatch(/<div data-component="RNSVGRect"/);
  });

  it('emits stroke-dasharray for spinner arcs', () => {
    const html = serializeHostTreeHtml({
      type: 'RNSVGCircle',
      props: {
        cx: 18,
        cy: 18,
        r: 16,
        fill: null,
        stroke: { type: 0, payload: 0xff_3c_83_f6 },
        strokeWidth: 4,
        strokeDasharray: ['14.1', '42.4'],
        strokeLinecap: 1,
      },
      children: null,
    });
    expect(html).toContain('stroke-dasharray="14.1 42.4"');
    expect(html).toContain('stroke-linecap="round"');
  });

  it('expands RN transform arrays and strips broken Animated css', () => {
    const html = serializeHostTreeHtml({
      type: 'View',
      props: {
        style: { width: 36, height: 36, transform: [{ rotate: '90deg' }] },
        dataSet: {
          component: 'Spinner',
          css: 'width:36px;height:36px;transform:rotate([object Object])',
        },
      },
      children: null,
    });
    expect(html).not.toContain('[object Object]');
    expect(html).toContain('transform:rotate(90deg)');
    expect(html).toContain('width:36px');
  });

  it('maps RN flex:0 to flex:0 1 auto so SVG width/height are kept', () => {
    const html = serializeHostTreeHtml({
      type: 'RNSVGSvgView',
      props: {
        minX: 0,
        minY: 0,
        vbWidth: 24,
        vbHeight: 24,
        bbWidth: 32,
        bbHeight: 32,
        style: { width: 32, height: 32, flex: 0 },
      },
      children: [
        {
          type: 'RNSVGPath',
          props: {
            d: 'M18 6 6 18',
            fill: null,
            stroke: { type: 0, payload: 0xff_fa_fa_fa },
            strokeWidth: 2,
          },
          children: null,
        },
      ],
    });
    expect(html).toContain('flex:0 1 auto');
    expect(html).not.toMatch(/flex:0(?:;|")/);
    expect(html).toContain('width:32px');
    expect(html).toContain('height:32px');
    expect(html).toContain('display:block');
    expect(html).toContain('flex-shrink:0');
  });

  it('applies Yoga View defaults on View hosts', () => {
    const html = serializeHostTreeHtml({
      type: 'View',
      props: { style: { backgroundColor: 'red' } },
      children: null,
    });
    expect(html).toContain('flex-direction:column');
    expect(html).toContain('flex-shrink:0');
    expect(html).toContain('flex-basis:auto');
    expect(html).toContain('align-content:flex-start');
    expect(html).toContain('box-sizing:border-box');
    expect(html).toContain('min-height:0');
    expect(html).toContain('min-width:0');
  });

  it('links external shell CSS when stylesheetHref is set', () => {
    const html = serializeHostTreeHtml(
      {
        type: 'View',
        props: { testID: 'root' },
        children: null,
      },
      { stylesheetHref: '../../snapshot-shell.css' }
    );
    expect(html).toContain(
      '<link rel="stylesheet" href="../../snapshot-shell.css" />'
    );
    expect(html).not.toContain('<style>');
  });

  it('hides covered RNSScreen siblings in a stack (native keeps them mounted)', () => {
    const html = serializeHostTreeHtml({
      type: 'RNSScreenStack',
      props: {},
      children: [
        {
          type: 'RNSScreen',
          props: {
            activityState: 2,
            testID: 'screen-spaces',
            style: { position: 'absolute' },
          },
          children: [
            {
              type: 'View',
              props: {},
              children: ['Spaces', 'New space'],
            },
          ],
        },
        {
          type: 'RNSScreen',
          props: {
            activityState: 2,
            testID: 'screen-account',
            style: { position: 'absolute' },
          },
          children: [
            {
              type: 'View',
              props: {},
              children: ['Account'],
            },
          ],
        },
      ],
    });
    expect(html).toMatch(/data-testid="screen-spaces"[^>]*aria-hidden="true"/);
    expect(html).toMatch(
      /data-testid="screen-spaces"[^>]*style="[^"]*display:none/
    );
    expect(html).toMatch(/data-testid="screen-account"[^>]*style="/);
    expect(html).not.toMatch(/data-testid="screen-account"[^>]*display:none/);
    expect(html).not.toMatch(
      /data-testid="screen-account"[^>]*aria-hidden="true"/
    );
  });

  it('hides RNSScreen when activityState is 0 (inactive tab)', () => {
    const html = serializeHostTreeHtml({
      type: 'RNSScreen',
      props: {
        activityState: 0,
        testID: 'tab-spaces',
        style: { flex: 1 },
      },
      children: [{ type: 'View', props: {}, children: ['Spaces'] }],
    });
    expect(html).toMatch(/data-testid="tab-spaces"[^>]*aria-hidden="true"/);
    expect(html).toMatch(
      /data-testid="tab-spaces"[^>]*style="[^"]*display:none/
    );
  });

  it('hides nested chrome from a covered root-stack screen (tabs FAB under modal)', () => {
    const html = serializeHostTreeHtml({
      type: 'RNSScreenStack',
      props: {},
      children: [
        {
          type: 'RNSScreen',
          props: { activityState: 2, testID: 'screen-tabs' },
          children: [
            {
              type: 'RNSScreenStack',
              props: {},
              children: [
                {
                  type: 'RNSScreen',
                  props: { activityState: 2, testID: 'tab-spaces-list' },
                  children: [
                    {
                      type: 'View',
                      props: { testID: 'spaces-header' },
                      children: ['Spaces'],
                    },
                    {
                      type: 'Pressable',
                      props: {
                        testID: 'space-create-fab',
                        accessibilityRole: 'button',
                        style: { position: 'absolute', bottom: 24, right: 24 },
                      },
                      children: [{ type: 'Text', props: {}, children: ['+'] }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'RNSScreen',
          props: { activityState: 2, testID: 'screen-space-ended' },
          children: [
            {
              type: 'View',
              props: { testID: 'ended-body' },
              children: ['This space has ended'],
            },
          ],
        },
      ],
    });
    expect(html).toContain('This space has ended');
    expect(html).toMatch(/data-testid="space-create-fab"[^>]*display:none/);
    expect(html).toMatch(/data-testid="spaces-header"[^>]*display:none/);
    expect(html).toMatch(/data-testid="screen-tabs"[^>]*display:none/);
    expect(html).not.toMatch(/data-testid="ended-body"[^>]*display:none/);
  });

  it('fills absolute overlay hosts and keeps centered modal content', () => {
    const html = serializeHostTreeHtml({
      type: 'View',
      props: {
        testID: 'modal-root',
        style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
        dataSet: { component: 'ModalRoot' },
      },
      children: [
        {
          type: 'View',
          props: {
            testID: 'modal-backdrop',
            dataSet: { component: 'ModalBackdrop' },
            style: { flex: 1, width: '100%', height: '100%' },
          },
          children: [
            {
              type: 'View',
              props: {
                style: {
                  flex: 1,
                  width: '100%',
                  height: '100%',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: 16,
                },
              },
              children: [
                {
                  type: 'View',
                  props: {
                    testID: 'modal-content',
                    dataSet: { component: 'ModalContent' },
                    style: { width: '100%', maxWidth: 358 },
                  },
                  children: ['Choose a sign-in method'],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(html).toContain('[data-component="ModalRoot"]');
    expect(html).toMatch(/data-testid="modal-root"[^>]*width:100%/);
    expect(html).toMatch(/data-testid="modal-root"[^>]*height:100%/);
    expect(html).toContain('justify-content:center');
    expect(html).toContain('align-items:center');
    expect(html).toContain('max-width:358px');
    expect(html).toContain('Choose a sign-in method');
  });
});
