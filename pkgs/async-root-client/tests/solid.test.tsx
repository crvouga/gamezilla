/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { createAsync } from '@pkgs/async-root-client/solid';
import { render, screen, waitFor } from '@solidjs/testing-library';

describe('createAsync', () => {
  test('exposes reactive status and value', async () => {
    let resolve: (v: string) => void = () => undefined;
    const pending = new Promise<string>((r) => {
      resolve = r;
    });
    function Fetcher() {
      const load = createAsync({ operation: async () => pending });
      return (
        <output>
          {load.status()}:{load.value() ?? '-'}
          <button type="button" onClick={() => void load.run()}>
            go
          </button>
        </output>
      );
    }
    render(() => <Fetcher />);
    const output = screen.getByRole('status');
    expect(output).toHaveTextContent('idle:-');
    screen.getByRole('button').click();
    expect(output).toHaveTextContent('running:-');
    resolve('done');
    await waitFor(() => expect(output).toHaveTextContent('success:done'));
  });

  test('aborts in-flight work when unmounted', async () => {
    let aborted = false;
    function Fetcher() {
      const load = createAsync({
        operation: (ctx) =>
          new Promise<never>((_r, reject) => {
            ctx.signal.addEventListener('abort', () => {
              aborted = true;
              reject(new DOMException('aborted', 'AbortError'));
            });
          }),
      });
      void load.run().catch(() => undefined);
      return <span>x</span>;
    }
    const { unmount } = render(() => <Fetcher />);
    unmount();
    await waitFor(() => expect(aborted).toBe(true));
  });
});
