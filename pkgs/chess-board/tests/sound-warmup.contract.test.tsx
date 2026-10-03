/** @jsxImportSource solid-js */
import { expect, test } from 'bun:test';
import { renderWithI18n } from '@pkgs/bun-test-solid/render';
import { createChessBoardSounds } from '@pkgs/chess-board/chess-board-sounds';
import type { AudioPlaybackPort } from '@pkgs/sounds/audio-playback/ports';
import { chessSoundUrls } from '@pkgs/sounds/chess-sound-urls';
import { AudioPlaybackProvider } from '@pkgs/sounds/solid';
import { noopAudio } from './support/board-fixture';

function interruptedWarmup() {
  const base = noopAudio();
  const waiting: { source: unknown; resolve: () => void }[] = [];
  const plays: unknown[] = [];
  const pauses: unknown[] = [];
  const port: AudioPlaybackPort = {
    ...base,
    createPlayer(source) {
      return {
        ...base.createPlayer(source),
        seekTo: () =>
          new Promise<void>((resolve) => waiting.push({ source, resolve })),
        play: () => {
          plays.push(source);
        },
        pause: () => {
          pauses.push(source);
        },
      };
    },
  };
  return { port, waiting, plays, pauses };
}
function scope(port: AudioPlaybackPort) {
  let player: ReturnType<typeof createChessBoardSounds> | undefined;
  function Probe() {
    player = createChessBoardSounds(() => true);
    return null;
  }
  const mounted = renderWithI18n(() => (
    <AudioPlaybackProvider value={port}>
      <Probe />
    </AudioPlaybackProvider>
  ));
  if (player === undefined) throw new Error('Sound probe did not mount');
  return { player, close: mounted.unmount };
}
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

test('closing the warming board cannot pause a second board already playing the same sound', async () => {
  // regression: chessboard-warmup-ownership
  const audio = interruptedWarmup();
  const first = scope(audio.port);
  const second = scope(audio.port);
  second.player.playMove();
  expect(audio.waiting.map((w) => w.source)).toEqual([
    chessSoundUrls.move,
    chessSoundUrls.move,
  ]);
  audio.waiting[1]?.resolve();
  await flush();
  expect(audio.plays).toEqual([chessSoundUrls.move]);
  first.close();
  audio.waiting[0]?.resolve();
  await flush();
  expect(audio.pauses).toEqual([]);
  second.close();
});
