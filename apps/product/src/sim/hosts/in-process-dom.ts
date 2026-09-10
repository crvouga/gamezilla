/**
 * bun:test — attach a `MultiAppSolidDomSession` over the happy-dom
 * `document` installed by the test preload. The lazy `import()` (and the
 * `.web.ts` sibling) keep `@pkgs/ui-testing-solid-dom` / `solid-js/web` out
 * of the product-simulator bundle, which mounts `live.App` into the real browser
 * document itself.
 */

type MultiAppSolidDomSessionFactory =
  typeof import('@pkgs/ui-testing-solid-dom')['createMultiAppSolidDomSession'];

export async function loadSolidDomSessionFactory(): Promise<MultiAppSolidDomSessionFactory> {
  if (typeof globalThis.document === 'undefined') {
    throw new Error(
      'inProcessRuntime: Solid DOM session requires a `document` (bun:test preload installs happy-dom)'
    );
  }
  const mod = await import('@pkgs/ui-testing-solid-dom');
  return mod.createMultiAppSolidDomSession;
}
