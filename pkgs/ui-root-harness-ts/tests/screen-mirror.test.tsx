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
    // An empty sandbox allows no scripts, forms, popups or navigation.
    expect(frame.getAttribute('sandbox')).toBe('');
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
});
