import { describe, expect, test } from 'bun:test';

import {
  createSnapshotHost,
  paintSnapshotHost,
  scopeSnapshotCss,
} from '@pkgs/harness-report-client/snapshot-surface';

describe('in-page snapshot surface', () => {
  test('rewrites document selectors onto the shadow viewport', () => {
    expect(scopeSnapshotCss('html,body{margin:0}:root{color:red}')).toBe(
      '.sr-snap-doc,.sr-snap-body{margin:0}.sr-snap-doc{color:red}'
    );
    expect(scopeSnapshotCss('html{height:100vh}body{min-height:100dvh}')).toBe(
      '.sr-snap-doc{height:100%}.sr-snap-body{min-height:100%}'
    );
  });

  test('paints the snapshot into a shadow tree and never an iframe', () => {
    const host = createSnapshotHost();
    document.body.appendChild(host);
    const hit = paintSnapshotHost(
      host,
      {
        key: 'frames/f.html',
        html: [
          '<html><head><style>.app{color:blue}</style></head>',
          '<body><main class="themeHost">hello</main></body></html>',
        ].join(''),
        css: 'html{height:100vh;color:red} main{color:blue}',
      },
      null
    );
    const shadow = host.shadowRoot;
    const css = shadow?.getElementById('sr-frame-css')?.textContent ?? '';
    const adopted = shadow?.querySelector('style[data-sr-snap]');
    expect(host.querySelector('iframe')).toBeNull();
    expect(shadow?.querySelector('iframe')).toBeNull();
    expect(adopted?.parentNode).toBe(shadow);
    expect(shadow?.querySelector('.themeHost')?.textContent).toBe('hello');
    expect(css).toContain('.sr-snap-doc{height:100%;color:red}');
    expect(css).toContain('main{color:blue}');
    expect(css).toContain('.themeHost');
    expect(css).not.toContain('contain:strict');
    expect(hit).toBe('none');
    host.remove();
  });

  test('a later frame replaces the painted snapshot', () => {
    const host = createSnapshotHost();
    document.body.appendChild(host);
    const css = 'html{background:#123456}';
    paintSnapshotHost(
      host,
      {
        key: 'frames/f.html',
        html: '<html class="dark"><body><main>first</main></body></html>',
        css,
      },
      null
    );
    const shadow = host.shadowRoot;
    expect(
      shadow?.querySelector('.sr-snap-doc')?.classList.contains('dark')
    ).toBe(true);
    expect(shadow?.querySelector('.sr-snap-body')).not.toBeNull();
    paintSnapshotHost(
      host,
      { key: 'frames/f.html', html: '<main>second</main>', css },
      null
    );
    expect(shadow?.querySelector('.sr-snap-body')?.textContent).toContain(
      'second'
    );
    expect(shadow?.querySelector('.sr-snap-body')?.textContent).not.toContain(
      'first'
    );
    paintSnapshotHost(
      host,
      { key: 'frames/g.html', html: '<main>third</main>', css },
      null
    );
    expect(shadow?.textContent).toContain('third');
    expect(shadow?.textContent).not.toContain('second');
    host.remove();
  });

  test('a vendor stylesheet in the page still applies inside the phone', () => {
    const host = createSnapshotHost();
    document.body.appendChild(host);
    paintSnapshotHost(
      host,
      {
        key: 'frames/stripe.html',
        html: [
          '<html><body><div class="dom-root">',
          '<div class="harness-browser-page"><style>',
          '@scope (.harness-browser-page) {',
          ':scope{background-color:rgb(9,9,9)}',
          '.icons svg{width:24px;height:16px}',
          '}</style><span class="icons"><svg id="mark"></svg></span>',
          '</div></div></body></html>',
        ].join(''),
        css: 'html{background:#123456}',
      },
      null
    );
    const shadow = host.shadowRoot;
    const page = shadow?.querySelector('.harness-browser-page');
    const mark = shadow?.querySelector('#mark');
    expect(page).not.toBeNull();
    expect(mark).not.toBeNull();
    expect(getComputedStyle(page as Element).backgroundColor).toBe(
      'rgb(9, 9, 9)'
    );
    expect(getComputedStyle(mark as Element).width).toBe('24px');
    host.remove();
  });
});
