import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { withDocumentPalette } from '@pkgs/ui-root-shared-ts/css-vars';
import { startupShellIssues } from '@pkgs/ui-root-shared-ts/startup-shell-check';
import { inlineDocumentFragments } from '@pkgs/vite-workspace-resolver-server-ts/inline-document-fragments';

const opening = inlineDocumentFragments(
  {
    'browser-opening.html': join(
      import.meta.dir,
      '../../../libs/app-root-client-ts/src/browser-opening.html'
    ),
    'browser-opening.css': join(
      import.meta.dir,
      '../../../pkgs/ui-root-client-ts/src/browser-opening.css'
    ),
  },
  withDocumentPalette
);

// regression: startup-shell-palette-drift
test('the opening document paints navigation in the product palette', async () => {
  const html = await Bun.file(join(import.meta.dir, '..', 'index.html')).text();
  expect(
    startupShellIssues(opening.transformIndexHtml.handler(html), 'product')
  ).toEqual([]);
});

test('opens Settings, changes appearance and accepts a private people search before modules run', async () => {
  const html = await Bun.file(join(import.meta.dir, '..', 'index.html')).text();
  const first = new DOMParser().parseFromString(
    opening.transformIndexHtml.handler(html),
    'text/html'
  );
  const shell = first.querySelector('[data-startup-shell]');
  const script = shell?.nextElementSibling;
  if (!shell || script?.tagName !== 'SCRIPT') throw new Error('Opening document missing');
  document.body.appendChild(document.importNode(shell, true));
  const fallback = document.querySelector('[data-startup-shell]');
  const clickLink = (path: string): void => {
    const link = fallback?.querySelector<HTMLAnchorElement>(`a[href="${path}"]`);
    if (!link || link.closest('[hidden]')) throw new Error(`No link to ${path}`);
    link.click();
  };
  const preference = 'ui.prefs/color-scheme';
  const previous = localStorage.getItem(preference);
  const initialUrl = location.href;
  try {
    history.replaceState(null, '', '/space/invitation');
    runInNewContext(script.textContent ?? '', {
      document, window: document.defaultView, location, history, localStorage, PopStateEvent: document.defaultView?.PopStateEvent, CustomEvent: document.defaultView?.CustomEvent,
      MutationObserver, matchMedia: () => ({ matches: false }),
    });
    expect(fallback?.querySelector('h1')?.textContent).not.toBe('Spaces');
    expect(location.pathname).toBe('/space/invitation');
    clickLink('/more');
    clickLink('/more/theme');
    const dark = fallback?.querySelector<HTMLInputElement>('[value="dark"]');
    if (!dark || dark.closest('[hidden]')) throw new Error('Missing appearance choices');
    dark.click();
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(JSON.parse(localStorage.getItem(preference) ?? 'null')).toEqual({ 'ui.prefs/value': 'dark' });
    clickLink('/search');
    const field = fallback?.querySelector<HTMLInputElement>('input[name="people-search"]');
    expect(location.pathname).toBe('/search');
    expect(document.activeElement).toBe(field ?? null);
    expect(field?.hasAttribute('data-sensitive')).toBe(true);
    expect(field?.closest('[hidden]')).toBeNull();
  } finally {
    fallback?.remove();
    history.replaceState(null, '', initialUrl);
    if (previous === null) localStorage.removeItem(preference);
    else localStorage.setItem(preference, previous);
    document.documentElement.removeAttribute('data-startup-preference');
    document.documentElement.removeAttribute('data-theme');
  }
});
