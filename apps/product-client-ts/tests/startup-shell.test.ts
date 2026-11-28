import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { eventConstructor } from '@pkgs/bun-test-solid-client-ts/native-event';
import { withDocumentPalette } from '@pkgs/ui-root-shared-ts/document-palette';
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

test('all four first-paint navigation illustrations travel in the document', async () => {
  const html = await Bun.file(join(import.meta.dir, '..', 'index.html')).text();
  const doc = new DOMParser().parseFromString(
    opening.transformIndexHtml.handler(html),
    'text/html'
  );
  const pictures = Array.from(
    doc.querySelectorAll('[data-startup-shell] nav img')
  );
  expect(pictures).toHaveLength(4);
  for (const picture of pictures) {
    expect(picture.getAttribute('src')).toMatch(
      /^data:image\/webp;base64,UklGR/
    );
  }
});

test('opens Sound from Settings and accepts a private people search before modules run', async () => {
  const html = await Bun.file(join(import.meta.dir, '..', 'index.html')).text();
  const first = new DOMParser().parseFromString(
    opening.transformIndexHtml.handler(html),
    'text/html'
  );
  const shell = first.querySelector('[data-startup-shell]');
  const script = shell?.nextElementSibling;
  if (!shell || script?.tagName !== 'SCRIPT')
    throw new Error('Opening document missing');
  document.body.appendChild(document.importNode(shell, true));
  const fallback = document.querySelector('[data-startup-shell]');
  const clickLink = (path: string): void => {
    const link = fallback?.querySelector<HTMLAnchorElement>(
      `a[href="${path}"]`
    );
    if (!link || link.closest('[hidden]'))
      throw new Error(`No link to ${path}`);
    link.click();
  };
  const initialUrl = location.href;
  try {
    history.replaceState(null, '', '/space/invitation');
    runInNewContext(script.textContent ?? '', {
      document,
      window,
      location,
      history,
      PopStateEvent: eventConstructor(window),
      MutationObserver,
    });
    expect(fallback?.querySelector('h1')?.textContent).not.toBe('Spaces');
    expect(location.pathname).toBe('/space/invitation');
    clickLink('/');
    const create = fallback?.querySelector<HTMLButtonElement>(
      '[data-startup-create]'
    );
    if (!create || create.closest('[hidden]'))
      throw new Error('Missing New space');
    create.click();
    expect(create.disabled).toBe(true);
    expect(create.textContent).toBe('Opening…');
    clickLink('/more');
    expect(create.disabled).toBe(false);
    clickLink('/more/sound');
    expect(location.pathname).toBe('/more/sound');
    expect(fallback?.querySelector('h1')?.textContent).toBe('Sound');
    expect(
      fallback?.querySelector('[data-route="/more/sound"]')?.closest('[hidden]')
    ).toBeNull();
    clickLink('/search');
    const field = fallback?.querySelector<HTMLInputElement>(
      'input[name="people-search"]'
    );
    expect(location.pathname).toBe('/search');
    expect(document.activeElement).toBe(field ?? null);
    expect(field?.hasAttribute('data-sensitive')).toBe(true);
    expect(field?.closest('[hidden]')).toBeNull();
  } finally {
    fallback?.remove();
    history.replaceState(null, '', initialUrl);
  }
});
