import type {
  Driver,
  DriverNode,
} from '@pkgs/ui-testing-root-shared-ts/driver';
export type BrowserCall = {
  readonly target: 'driver' | 'node' | 'view';
  readonly path: readonly string[];
  readonly method: string;
  readonly args: readonly unknown[];
};
export type BrowserRpc = <T>(call: BrowserCall) => Promise<T>;
function node(rpc: BrowserRpc, path: readonly string[]): DriverNode {
  const call = <T>(method: string, ...args: unknown[]) =>
    rpc<T>({ target: 'node', path, method, args });
  return {
    get: (id) => node(rpc, [...path, id]),
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
/** The same Driver interface, with all browser work remaining in its own process. */
export function remoteBrowserDriver(rpc: BrowserRpc): Driver {
  const call = <T>(method: string, ...args: unknown[]) =>
    rpc<T>({ target: 'driver', path: [], method, args });
  return {
    kind: 'isolated-browser',
    get: (id) => node(rpc, [id]),
    launch: () => call('launch'),
    close: () => call('close'),
    key: (key) => call('key', key),
    snapshotHtml: (options) => call('snapshotHtml', options),
  };
}
