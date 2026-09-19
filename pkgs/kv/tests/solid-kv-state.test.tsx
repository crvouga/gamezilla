/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { createSimClock } from '@pkgs/clock/sim-clock';
import { ClockProvider } from '@pkgs/clock/solid';
import { asKeyword } from '@pkgs/keyword/keyword';
import type { Kv, KvRecord } from '@pkgs/kv/interface';
import { booleanKvCodec } from '@pkgs/kv/kv-state-codec';
import { createKvState, KvProvider, useKvOptional } from '@pkgs/kv/solid';
import { render, screen, waitFor } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';

const KEY = asKeyword('ui.prefs/test-flag');
const CODEC = booleanKvCodec(asKeyword('ui.prefs/value'));

type FakeKv = Kv & {
  readonly puts: KvRecord[];
  resolveGet: (record: KvRecord | null) => void;
};

function createFakeKv(): FakeKv {
  let resolveGet: (record: KvRecord | null) => void = () => undefined;
  const pending = new Promise<KvRecord | null>((resolve) => {
    resolveGet = resolve;
  });
  const puts: KvRecord[] = [];
  const kv = {
    get: () => pending,
    put: (_key: unknown, record: KvRecord) => {
      puts.push(record);
      return Promise.resolve();
    },
  } as unknown as Kv;
  return Object.assign(kv, {
    puts,
    resolveGet: (r: KvRecord | null) => resolveGet(r),
  });
}

function Flag(): JSX.Element {
  const [flag, setFlag] = createKvState<boolean>({
    key: KEY,
    default: false,
    codec: CODEC,
  });
  return (
    <button type="button" onClick={() => setFlag((prev) => !prev)}>
      {flag() ? 'on' : 'off'}
    </button>
  );
}

function withClock(children: () => JSX.Element): JSX.Element {
  const { clock, timers } = createSimClock();
  return (
    <ClockProvider clock={clock} timers={timers}>
      {children()}
    </ClockProvider>
  );
}

describe('createKvState', () => {
  test('hydrates from kv and persists writes', async () => {
    const kv = createFakeKv();
    render(() =>
      withClock(() => (
        <KvProvider value={kv}>
          <Flag />
        </KvProvider>
      ))
    );
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('off');

    kv.resolveGet(CODEC.encode(true));
    await waitFor(() => expect(button).toHaveTextContent('on'));

    button.click();
    expect(button).toHaveTextContent('off');
    expect(kv.puts).toEqual([CODEC.encode(false)]);
  });

  test('a late hydrate cannot clobber a local write', async () => {
    const kv = createFakeKv();
    render(() =>
      withClock(() => (
        <KvProvider value={kv}>
          <Flag />
        </KvProvider>
      ))
    );
    const button = screen.getByRole('button');
    button.click();
    expect(button).toHaveTextContent('on');
    kv.resolveGet(CODEC.encode(false));
    await Promise.resolve();
    await Promise.resolve();
    expect(button).toHaveTextContent('on');
  });

  test('falls back to in-memory state without a provider', () => {
    let ambient: Kv | undefined;
    function Probe(): JSX.Element {
      ambient = useKvOptional();
      return <Flag />;
    }
    render(() => withClock(() => <Probe />));
    expect(ambient).toBeUndefined();
    const button = screen.getByRole('button');
    button.click();
    expect(button).toHaveTextContent('on');
  });
});
