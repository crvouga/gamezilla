/** Playground web bundle — the console mounts `live.App` into the browser document itself. */

type MultiAppSolidDomSessionFactory =
  typeof import('@pkgs/ui-testing-solid-dom')['createMultiAppSolidDomSession'];

export function loadSolidDomSessionFactory(): Promise<MultiAppSolidDomSessionFactory> {
  return Promise.reject(
    new Error('Solid DOM session factory is bun:test-only')
  );
}
