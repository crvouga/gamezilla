import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import type { BunWebView } from '@pkgs/ui-testing-bun-webview-shared-ts/bun-webview-host';

type OperationName = string | (() => string);
type View = BunWebView & Pick<Bun.WebView, 'url' | 'loading'>;
export type TraceBrowserCall = (
  call: () => Promise<unknown>,
  report: (operation: string) => void
) => Promise<unknown>;

// Fast calls send no extra IPC. A slow one can report even while the renderer
// is silent; this timer runs in the child driving the renderer.
const SLOW_CALL_MS = 5_000;

/** Keep only driver source locations. Scripts, URLs and typed values stay out. */
function driverLocations(stack: Error): string {
  const frames = (stack.stack ?? '').matchAll(
    /[/\\]ui-testing-bun-webview-shared-ts[/\\]src[/\\]([a-z-]+\.ts:\d+):\d+/g
  );
  const location = Array.from(frames, (frame) => frame[1])
    .slice(0, 3)
    .join(' ← ');
  return location ? ` at ${location}` : '';
}

/** One device serializes its page calls. */
export function browserCallDiagnostics(clock: Clock, timers: Timers) {
  let observe: ((name: OperationName) => (outcome: string) => void) | undefined;

  const traceCall: TraceBrowserCall = async (call, report) => {
    let count = 0;
    const start = clock.now();
    let slow = false;
    let latest = () => {};
    observe = (name) => {
      const index = ++count;
      const offset = clock.now() - start;
      const stack = new Error();
      let outcome = 'pending';
      latest = () =>
        report(
          `${typeof name === 'string' ? name : name()} #${index} (+${offset}ms) ${outcome}${driverLocations(stack)}`
        );
      if (slow) latest();
      return (result) => {
        outcome = result;
        if (slow && index === count) latest();
      };
    };
    const timer = timers.setTimeout(() => {
      slow = true;
      latest();
    }, SLOW_CALL_MS);
    try {
      return await call();
    } finally {
      timers.clearTimeout(timer);
      observe = undefined;
      slow = false;
    }
  };

  function watch<T>(name: OperationName, call: () => Promise<T>): Promise<T> {
    const finish = observe?.(name);
    const answer = call();
    if (finish)
      void answer.then(
        () => finish('returned'),
        () => finish('rejected')
      );
    return answer;
  }

  function view(native: View, window: 'opener' | 'popup'): View {
    return {
      get url() {
        return native.url;
      },
      get loading() {
        return native.loading;
      },
      navigate: (url) =>
        watch(`${window}.navigate`, () => native.navigate(url)),
      evaluate: (script) =>
        watch(`${window}.evaluate`, () => native.evaluate(script)),
      click: (...args: [string] | Parameters<BunWebView['click']>) =>
        watch(`${window}.click`, () =>
          args.length === 1 ? native.click(args[0]) : native.click(...args)
        ),
      press: (key) => native.press(key),
      close: () => native.close(),
      screenshot: () => native.screenshot(),
    };
  }

  return { traceCall, view, watch };
}
