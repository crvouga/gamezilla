/**
 * Board SFX over the injected `@pkgs/sounds` audio port. Every board on a
 * screen shares one bank of players per port (a review list of 20 boards
 * holds 7 players, not 140), created and pre-warmed by the first board so
 * the first move plays without a decode stall, and removed with the last.
 * Each board keeps its own play handles, cancelled when it unmounts.
 */

import type { ChessMoveSoundPlayer } from '@pkgs/chess-board-core/move-sound';
import type {
  AudioPlaybackPort,
  AudioPlayerHandle,
} from '@pkgs/sounds/audio-playback/ports';
import { chessSoundUrls } from '@pkgs/sounds/chess-sound-urls';
import {
  createPlayFromStartHandles,
  useAudioPlaybackPort,
  warmAudioPlayers,
} from '@pkgs/sounds/solid';
import { onCleanup } from 'solid-js';

const BOARD_SOUND_KEYS = [
  'move',
  'capture',
  'check',
  'castle',
  'promote',
  'illegal',
  'gameEnd',
] as const;

type BoardSoundKey = (typeof BOARD_SOUND_KEYS)[number];

type Bank = {
  readonly players: Readonly<Record<BoardSoundKey, AudioPlayerHandle>>;
  boards: number;
};

const banks = new WeakMap<AudioPlaybackPort, Bank>();

function createBank(port: AudioPlaybackPort): Bank {
  const players = Object.fromEntries(
    BOARD_SOUND_KEYS.map((key) => [key, port.createPlayer(chessSoundUrls[key])])
  ) as Record<BoardSoundKey, AudioPlayerHandle>;
  return { players, boards: 0 };
}

function releaseBank(port: AudioPlaybackPort, bank: Bank): void {
  bank.boards -= 1;
  if (bank.boards > 0) return;
  banks.delete(port);
  for (const key of BOARD_SOUND_KEYS) {
    try {
      bank.players[key].remove();
    } catch {
      // Released player races.
    }
  }
}

/** Must run inside a Solid owner (component body / `createRoot`). */
export function createChessBoardSounds(): ChessMoveSoundPlayer {
  const port = useAudioPlaybackPort();
  const existing = banks.get(port);
  const bank = existing ?? createBank(port);
  if (existing === undefined) banks.set(port, bank);
  bank.boards += 1;
  const handles = createPlayFromStartHandles(bank.players);
  const handleList = BOARD_SOUND_KEYS.map((key) => handles[key]);
  if (existing === undefined) {
    // Warms once per bank; also cancels this board's handles on cleanup.
    warmAudioPlayers(
      BOARD_SOUND_KEYS.map((key) => bank.players[key]),
      handleList
    );
  } else {
    onCleanup(() => {
      for (const handle of handleList) handle.cancel();
    });
  }
  onCleanup(() => releaseBank(port, bank));
  return {
    playMove: () => handles.move.play(),
    playCapture: () => handles.capture.play(),
    playCheck: () => handles.check.play(),
    playCastle: () => handles.castle.play(),
    playPromote: () => handles.promote.play(),
    playIllegal: () => handles.illegal.play(),
    playGameEnd: () => handles.gameEnd.play(),
  };
}
