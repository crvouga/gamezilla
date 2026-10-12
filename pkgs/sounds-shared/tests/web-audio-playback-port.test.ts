import { describe, expect, test } from 'bun:test';
import type { AudioPlayerStatus } from '@pkgs/sounds-shared/ports';
import type {
  AudioBufferLike,
  AudioContextLike,
  AudioSourceNodeLike,
} from '@pkgs/sounds-shared/web-audio-buffer-backend';
import { START_WINDOW_MS } from '@pkgs/sounds-shared/web-audio-buffer-backend';
import { createWebAudioPlaybackPort } from '@pkgs/sounds-shared/web-audio-playback-port';

type FakeSource = AudioSourceNodeLike & {
  readonly url: string;
  readonly offsets: number[];
  stopped: boolean;
};

/** A Web Audio engine that records what it was asked to play. */
function fakeEngine(seconds = 0.3) {
  const sources: FakeSource[] = [];
  const pending: (() => void)[] = [];
  const state = {
    context: 'running',
    time: 0,
    nowMs: 0,
    loadsHeld: false,
    undecodable: false,
  };
  const urlOf = new WeakMap<AudioBufferLike, string>();
  const context: AudioContextLike = {
    get state() {
      return state.context;
    },
    get currentTime() {
      return state.time;
    },
    destination: {},
    resume: () =>
      new Promise<void>((resolve) => {
        pending.push(() => {
          state.context = 'running';
          resolve();
        });
      }),
    createGain: () => ({
      gain: { value: 1 },
      connect: () => undefined,
      disconnect: () => undefined,
    }),
    createBufferSource() {
      const source: FakeSource = {
        buffer: null,
        onended: null,
        url: '',
        offsets: [],
        stopped: false,
        connect: () => undefined,
        disconnect: () => undefined,
        start(_when, offset) {
          source.offsets.push(offset ?? 0);
          sources.push(source);
        },
        stop() {
          source.stopped = true;
        },
      };
      return source;
    },
    decodeAudioData(data, onDecoded, onError) {
      if (state.undecodable) {
        // What a browser does with bytes that are not audio: the callback
        // and the returned promise both carry the error.
        const error = new Error('Decoding failed');
        onError(error);
        return Promise.reject(error);
      }
      const buffer = { duration: seconds };
      urlOf.set(buffer, new TextDecoder().decode(data));
      onDecoded(buffer);
      return undefined;
    },
  };
  return {
    options: {
      context,
      fetch: (url: string) =>
        new Promise<Response>((resolve) => {
          const deliver = () =>
            resolve({
              ok: true,
              status: 200,
              arrayBuffer: () =>
                Promise.resolve(new TextEncoder().encode(url).buffer),
            } as Response);
          if (state.loadsHeld) pending.push(deliver);
          else deliver();
        }),
      now: () => state.nowMs,
    },
    state,
    /** What started, in order, as `url@offset`. */
    started: () =>
      sources.map(
        (s) =>
          `${urlOf.get(s.buffer as AudioBufferLike) ?? ''}@${String(s.offsets[0])}`
      ),
    sources,
    /** Let held loads and `resume` calls finish. */
    release() {
      for (const run of pending.splice(0)) run();
    },
  };
}

/** Let fetched bytes, decoding and `resume` reach the players. */
async function settle(): Promise<void> {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}

describe('effects play through Web Audio', () => {
  // regression: sounds-overlapping-media-elements-block-page
  test('two effects asked for back to back both start, on no media element', async () => {
    // No `Audio` exists in this runtime: reaching for an element would throw.
    const fake = fakeEngine();
    const port = createWebAudioPlaybackPort(fake.options);
    const move = port.createPlayer('/sounds/move.mp3');
    const refusal = port.createPlayer({ uri: '/sounds/refusal.mp3' });
    await settle();

    void move.play();
    void refusal.play();

    expect(fake.started()).toEqual([
      '/sounds/move.mp3@0',
      '/sounds/refusal.mp3@0',
    ]);
    expect(port.getStatus(move).playing).toBe(true);
    expect(port.getStatus(refusal).playing).toBe(true);
  });

  test('pause, seek to the start and play again restarts the effect once', async () => {
    const fake = fakeEngine();
    const port = createWebAudioPlaybackPort(fake.options);
    const player = port.createPlayer('/sounds/move.mp3');
    await settle();
    void player.play();
    fake.state.time = 0.1;

    player.pause();
    expect(port.getStatus(player).currentTime).toBeCloseTo(0.1);
    await player.seekTo(0);
    void player.play();

    expect(fake.started()).toEqual([
      '/sounds/move.mp3@0',
      '/sounds/move.mp3@0',
    ]);
    expect(fake.sources[0]?.stopped).toBe(true);
    expect(fake.sources[1]?.stopped).toBe(false);
  });

  test('an effect that plays to its end says so once, then starts over', async () => {
    const fake = fakeEngine(0.3);
    const port = createWebAudioPlaybackPort(fake.options);
    const player = port.createPlayer('/sounds/move.mp3');
    const seen: AudioPlayerStatus[] = [];
    port.subscribeStatus(player, (status) => seen.push(status));
    await settle();
    void player.play();

    fake.state.time = 0.3;
    fake.sources[0]?.onended?.();

    expect(seen.at(-1)).toMatchObject({ playing: false, didJustFinish: true });
    expect(port.getStatus(player)).toMatchObject({
      didJustFinish: false,
      isLoaded: true,
      duration: 0.3,
    });
    void player.play();
    expect(fake.started().at(-1)).toBe('/sounds/move.mp3@0');
  });
});

describe('an effect starts promptly or not at all', () => {
  test('asked for while still loading, it starts as soon as it has loaded', async () => {
    const fake = fakeEngine();
    fake.state.loadsHeld = true;
    const port = createWebAudioPlaybackPort(fake.options);
    const player = port.createPlayer('/sounds/move.mp3');
    expect(port.getStatus(player).isLoaded).toBe(false);

    void player.play();
    expect(fake.started()).toEqual([]);
    fake.state.nowMs = START_WINDOW_MS;
    fake.release();
    await settle();

    expect(fake.started()).toEqual(['/sounds/move.mp3@0']);
  });

  test('one that loads too late stays silent', async () => {
    const fake = fakeEngine();
    fake.state.loadsHeld = true;
    const port = createWebAudioPlaybackPort(fake.options);
    const player = port.createPlayer('/sounds/move.mp3');

    void player.play();
    fake.state.nowMs = START_WINDOW_MS + 1;
    fake.release();
    await settle();

    expect(fake.started()).toEqual([]);
    expect(port.getStatus(player)).toMatchObject({
      isLoaded: true,
      playing: false,
    });
  });

  test('before the first gesture it resumes the context, and plays only if that is quick', async () => {
    const fake = fakeEngine();
    fake.state.context = 'suspended';
    const port = createWebAudioPlaybackPort(fake.options);
    const quick = port.createPlayer('/sounds/quick.mp3');
    const late = port.createPlayer('/sounds/late.mp3');
    await settle();

    void late.play();
    fake.state.nowMs = START_WINDOW_MS + 1;
    void quick.play();
    expect(fake.started()).toEqual([]);
    fake.release();
    await settle();

    expect(fake.started()).toEqual(['/sounds/quick.mp3@0']);
  });

  test('a paused request and a removed player never start', async () => {
    const fake = fakeEngine();
    fake.state.loadsHeld = true;
    const port = createWebAudioPlaybackPort(fake.options);
    const paused = port.createPlayer('/sounds/paused.mp3');
    const removed = port.createPlayer('/sounds/removed.mp3');

    void paused.play();
    paused.pause();
    void removed.play();
    removed.remove();
    fake.release();
    await settle();

    expect(fake.started()).toEqual([]);
  });
});

test('replacing an effect loads the new sound and stops the old one', async () => {
  const fake = fakeEngine();
  const port = createWebAudioPlaybackPort(fake.options);
  const player = port.createPlayer('/sounds/one.mp3');
  await settle();
  void player.play();

  player.replace('/sounds/two.mp3');
  await settle();
  void player.play();

  expect(fake.sources[0]?.stopped).toBe(true);
  expect(fake.started()).toEqual(['/sounds/one.mp3@0', '/sounds/two.mp3@0']);
});

// regression: sounds-undecodable-effect-unhandled-rejection
test('an effect whose bytes are not audio stays silent without an unhandled rejection', async () => {
  const fake = fakeEngine();
  fake.state.undecodable = true;
  const port = createWebAudioPlaybackPort(fake.options);
  const player = port.createPlayer('/sounds/not-audio.mp3');
  const rejections: unknown[] = [];
  const onRejection = (reason: unknown): void => {
    rejections.push(reason);
  };
  process.on('unhandledRejection', onRejection);
  try {
    void player.play();
    await settle();
    await settle();
  } finally {
    process.off('unhandledRejection', onRejection);
  }

  expect(rejections).toEqual([]);
  expect(fake.started()).toEqual([]);
  expect(port.getStatus(player)).toMatchObject({
    isLoaded: false,
    playing: false,
  });
});
