import type {
  Driver,
  DriverNode,
} from '@pkgs/ui-testing-root-shared-ts/driver';
import type { VisibleRegion } from './document-region';

export type DocumentControls = Pick<Driver, 'get'> & {
  readonly visibleRegion: VisibleRegion;
};

export type BrowserDocument = {
  readonly origin: string;
  readonly title: string;
};

export type BrowserCall = {
  readonly target: 'driver' | 'node' | 'document-node' | 'view';
  readonly path: readonly string[];
  readonly method: string;
  readonly args: readonly unknown[];
};
/**
 * Reading native navigation state and closing run no page JavaScript: the browser
 * answers them even while another call is still running in the page.
 */
export function runsNoPageCode(call: BrowserCall): boolean {
  return (
    (call.target === 'view' &&
      (call.method === 'loadedUrl' || call.method === 'readyDocument')) ||
    (call.target === 'driver' && call.method === 'close')
  );
}
export type BrowserRpc = <T>(call: BrowserCall) => Promise<T>;
function node(
  rpc: BrowserRpc,
  path: readonly string[],
  target: 'node' | 'document-node'
): DriverNode {
  const call = <T>(method: string, ...args: unknown[]) =>
    rpc<T>({ target, path, method, args });
  return {
    get: (id) => node(rpc, [...path, id], target),
    attribute: (name) => call('attribute', name),
    tap: (options) => call('tap', options),
    tapAt: (position, options) => call('tapAt', position, options),
    drag: (from, to, options) => call('drag', from, to, options),
    layout: () => call('layout'),
    input: (text, options) => call('input', text, options),
    selectFile: (file) => call('selectFile', file),
    clear: () => call('clear'),
    key: (key) => call('key', key),
    scroll: (direction, amount) => call('scroll', direction, amount),
    wait: (state, options) => call('wait', state, options),
    isVisible: () => call('isVisible'),
    text: () => call('text'),
    expect: {
      visible: (options) => call('expect.visible', options),
      hidden: (options) => call('expect.hidden', options),
      text: (text, options) => call('expect.text', text, options),
    },
  };
}
/** Controls in the main tab, even when a popup contains the same test id. */
export function documentControls(rpc: BrowserRpc): DocumentControls {
  return {
    get: (id) => node(rpc, [id], 'document-node'),
    visibleRegion: (origin, markers) =>
      rpc({
        target: 'view',
        path: [],
        method: 'visibleRegion',
        args: [origin, markers],
      }),
  };
}

/** The same Driver interface, with all browser work remaining in its own process. */
export function remoteBrowserDriver(rpc: BrowserRpc): Driver {
  const call = <T>(method: string, ...args: unknown[]) =>
    rpc<T>({ target: 'driver', path: [], method, args });
  return {
    kind: 'isolated-browser',
    get: (id) => node(rpc, [id], 'node'),
    launch: () => call('launch'),
    close: () => call('close'),
    key: (key) => call('key', key),
    snapshotHtml: (options) => call('snapshotHtml', options),
  };
}
