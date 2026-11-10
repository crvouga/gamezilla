/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { ScreenMirror } from '@pkgs/ui-root-client-ts/screen-mirror';
import { screen } from '@solidjs/testing-library';
import { renderUi } from './render';

describe('ScreenMirror', () => {
  test('draws the other screen in a sandbox where nothing can run', () => {
    renderUi(() => (
      <ScreenMirror
        title="Bob's screen"
        html="<body><p>Settings</p></body>"
        dataSet={{ testid: 'mirror' }}
      />
    ));
    const frame = screen.getByTitle("Bob's screen");
    expect(frame.tagName).toBe('IFRAME');
    // regression: screen-mirror-sandbox-service-worker-error
    // Same origin only: no scripts, forms, popups or navigation.
    expect(frame.getAttribute('sandbox')).toBe('allow-same-origin');
    expect(frame.getAttribute('sandbox')).not.toContain('allow-scripts');
    expect(frame.getAttribute('data-testid')).toBe('mirror');
    expect(frame.getAttribute('srcdoc')).toContain('<p>Settings</p>');
    expect(frame.getAttribute('srcdoc')).toContain('pointer-events:none');
  });

  test('carries this app’s stylesheets so the screen looks as it does there', () => {
    const style = document.createElement('style');
    style.textContent = '.mirror-probe{color:red}';
    document.head.append(style);
    try {
      renderUi(() => <ScreenMirror title="Cedar's screen" html="<body/>" />);
      expect(
        screen.getByTitle("Cedar's screen").getAttribute('srcdoc')
      ).toContain('.mirror-probe{color:red}');
    } finally {
      style.remove();
    }
  });

  test('updates in place when a new picture arrives', async () => {
    const { createSignal } = await import('solid-js');
    const [html, setHtml] = createSignal('<body><p>Spaces</p></body>');
    renderUi(() => <ScreenMirror title="Bob's screen" html={html()} />);
    setHtml('<body><p>Settings</p></body>');
    const srcdoc = screen.getByTitle("Bob's screen").getAttribute('srcdoc');
    expect(srcdoc).toContain('Settings');
    expect(srcdoc).not.toContain('Spaces');
  });

  test('is never wider than the device it mirrors', () => {
    renderUi(() => (
      <>
        <ScreenMirror title="Bob's phone" html="<body/>" />
        <ScreenMirror title="Bob's desktop" html="<body/>" device="desktop" />
      </>
    ));
    const host = (title: string): HTMLElement => {
      const element = screen.getByTitle(title).parentElement;
      if (element === null) throw new Error(`${title} has no host`);
      return element;
    };
    // The 390px phone and 1280px desktop, each inside its 1px hairline.
    expect(host("Bob's phone").style.maxWidth).toBe('392px');
    expect(host("Bob's desktop").style.maxWidth).toBe('1282px');
  });
});
