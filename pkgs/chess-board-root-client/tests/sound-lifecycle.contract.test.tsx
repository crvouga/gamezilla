/** @jsxImportSource solid-js */
import { expect, test } from 'bun:test';
import { renderWithI18n } from '@pkgs/bun-test-solid-client/render';
import { createChessBoardSounds } from '@pkgs/chess-board-root-client/chess-board-sounds';
import { AudioPlaybackProvider } from '@pkgs/sounds-client/solid';
import { chessSoundUrls } from '@pkgs/sounds-shared/chess-sound-urls';
import type { AudioPlaybackPort } from '@pkgs/sounds-shared/ports';
import { createSignal } from 'solid-js';
import { noopAudio } from './board-fixture';

function deferredAudio() {
  const base = noopAudio();
  const waiting: (() => void)[] = [];
  const played: unknown[] = [];
  const port: AudioPlaybackPort = {
    ...base,
    createPlayer(source) {
      return {
        ...base.createPlayer(source),
        seekTo: () => new Promise<void>((resolve) => waiting.push(resolve)),
        play: () => {
          played.push(source);
        },
      };
    },
  };
  return {
    port,
    played,
    async release() {
      for (let i = 0; i < 20; i += 1) {
        for (const resolve of waiting.splice(0)) resolve();
        await Promise.resolve();
      }
    },
  };
}
function scope(port: AudioPlaybackPort, initially = true) {
  const [enabled, setEnabled] = createSignal(initially);
  let player: ReturnType<typeof createChessBoardSounds> | undefined;
  function Probe() {
    player = createChessBoardSounds(enabled);
    return null;
  }
  const mounted = renderWithI18n(() => (
    <AudioPlaybackProvider value={port}>
      <Probe />
    </AudioPlaybackProvider>
  ));
  if (player === undefined) throw new Error('Audio scope did not mount');
  return { player, setEnabled, close: mounted.unmount };
}
test('disabling and re-enabling during a blocked seek never resurrects old sound', async () => {
  // regression: chessboard-sound-authority
  const audio = deferredAudio();
  const board = scope(audio.port);
  board.player.playCapture();
  board.setEnabled(false);
  board.setEnabled(true);
  await audio.release();
  expect(audio.played).toEqual([]);
  board.player.playMove();
  await audio.release();
  expect(audio.played).toEqual([chessSoundUrls.move]);
  board.close();
});
test('unmount cancels a blocked seek before it can play', async () => {
  const audio = deferredAudio();
  const board = scope(audio.port);
  board.player.playCheck();
  board.close();
  await audio.release();
  expect(audio.played).toEqual([]);
});
test('a sound requested while disabled cannot play after re-enabling', async () => {
  // regression: chessboard-disabled-sound-request
  const audio = deferredAudio();
  const board = scope(audio.port, false);
  board.player.playMove();
  board.setEnabled(true);
  await audio.release();
  expect(audio.played).toEqual([]);
  board.close();
});
test('a disposed board sound handle stays inert', async () => {
  // regression: chessboard-disposed-sound-request
  const audio = deferredAudio();
  const board = scope(audio.port);
  board.close();
  board.player.playMove();
  await audio.release();
  expect(audio.played).toEqual([]);
});
test('muting or closing one board cannot trigger or cancel the other board', async () => {
  const audio = deferredAudio();
  const a = scope(audio.port);
  const b = scope(audio.port);
  a.player.playMove();
  b.player.playCapture();
  a.setEnabled(false);
  a.close();
  await audio.release();
  expect(audio.played).toEqual([chessSoundUrls.capture]);
  b.player.playCheck();
  await audio.release();
  expect(audio.played).toEqual([chessSoundUrls.capture, chessSoundUrls.check]);
  b.close();
});
