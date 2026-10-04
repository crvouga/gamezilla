/** @jsxImportSource solid-js */
/**
 * Vendor pages (Stripe checkout, OAuth screens) keep their stylesheet on the
 * page wrapper, scoped so a report snapshot paints it and the app does not
 * inherit it.
 */
import { describe, expect, test } from 'bun:test';
import { DocumentPage } from '@libs/harness/document-page-view';
import { render } from 'solid-js/web';

const PAGE = [
  '<html><head><style>',
  ':root{--ink:#123456}',
  'html,body{margin:0;background:#fff;min-height:100vh}',
  ':root:has(input[name="oauth-theme"][value="dark"]:checked){--ink:#fff}',
  '.icons svg{width:24px;height:16px}',
  '.testcards .body{padding:0 12px 12px}',
  '.line-body{color:#112233}',
  '</style></head><body>',
  '<div class="icons"><svg data-testid="mark"></svg></div>',
  '<div class="testcards"><div class="body" data-testid="card-body"></div></div>',
  '<script>boom()</script>',
  '</body></html>',
].join('');

describe('vendor document page', () => {
  test('keeps the page stylesheet scoped to the page wrapper', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const dispose = render(
      () => (
        <DocumentPage
          html={PAGE}
          navigate={() => undefined}
          post={() => undefined}
          url="http://billing.harness/checkout"
        />
      ),
      host
    );
    const page = host.querySelector('.harness-browser-page');
    const css = page?.querySelector('style')?.textContent ?? '';
    expect(page?.querySelector('[data-testid="mark"]')).not.toBeNull();
    expect(page?.querySelector('script')).toBeNull();
    expect(css.startsWith('@scope (.harness-browser-page)')).toBe(true);
    expect(css).toContain(':scope{--ink:#123456}');
    expect(css).toContain(
      ':scope,:scope{margin:0;background:#fff;min-height:100%}'
    );
    expect(css).toContain(':scope:has(input[name="oauth-theme"]');
    expect(css).toContain('.icons svg{width:24px;height:16px}');
    expect(css).toContain('.testcards .body{padding:0 12px 12px}');
    expect(css).toContain('.line-body{color:#112233}');
    expect(css).not.toContain(':root');
    expect(css).not.toContain('100vh');
    expect(css).not.toContain('.:scope');
    expect(
      getComputedStyle(
        page?.querySelector('[data-testid="card-body"]') as Element
      ).padding
    ).toBe('0px 12px 12px');
    expect(getComputedStyle(page?.querySelector('svg') as Element).width).toBe(
      '24px'
    );
    const outside = document.createElement('div');
    outside.className = 'icons';
    outside.innerHTML = '<svg></svg>';
    document.body.appendChild(outside);
    expect(
      getComputedStyle(outside.querySelector('svg') as Element).width
    ).not.toBe('24px');
    outside.remove();
    dispose();
    host.remove();
  });
});
