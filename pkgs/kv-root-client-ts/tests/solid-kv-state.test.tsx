/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { asKeyword } from '@pkgs/keyword-shared-ts/keyword';
import {
  createKvState,
  KvProvider,
  useKvOptional,
} from '@pkgs/kv-root-client-ts/solid';
import type { Kv, KvRecord } from '@pkgs/kv-root-shared-ts/interface';
import { booleanKvCodec } from '@pkgs/kv-root-shared-ts/kv-state-codec';
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
  const { clock, timers } = createHarnessClock();
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

  test('onHydrated fires after the persisted read settles', async () => {
    const kv = createFakeKv();
    let hydrated = 0;
    function Flag(): JSX.Element {
      const [flag] = createKvState<boolean>({
        key: KEY,
        default: false,
        codec: CODEC,
        onHydrated: () => {
          hydrated += 1;
        },
      });
      return <span>{flag() ? 'on' : 'off'}</span>;
    }
    render(() =>
      withClock(() => (
        <KvProvider value={kv}>
          <Flag />
        </KvProvider>
      ))
    );
    expect(hydrated).toBe(0);
    kv.resolveGet(CODEC.encode(true));
    await waitFor(() => expect(hydrated).toBe(1));
    expect(screen.getByText('on')).toBeTruthy();
  });

  test('onHydrated fires without a provider', async () => {
    let hydrated = 0;
    function Flag(): JSX.Element {
      createKvState<boolean>({
        key: KEY,
        default: false,
        codec: CODEC,
        onHydrated: () => {
          hydrated += 1;
        },
      });
      return null;
    }
    render(() => withClock(() => <Flag />));
    await waitFor(() => expect(hydrated).toBe(1));
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
