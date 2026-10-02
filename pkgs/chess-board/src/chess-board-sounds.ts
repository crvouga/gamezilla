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
import type { PlayFromStartHandle } from '@pkgs/sounds/play-from-start';
import {
  createPlayFromStartHandles,
  useAudioPlaybackPort,
  warmAudioPlayers,
} from '@pkgs/sounds/solid';
import { type Accessor, createEffect, onCleanup } from 'solid-js';

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
  readonly owners: Map<BoardSoundKey, symbol>;
};

const banks = new WeakMap<AudioPlaybackPort, Bank>();

function createBank(port: AudioPlaybackPort): Bank {
  const players = Object.fromEntries(
    BOARD_SOUND_KEYS.map((key) => [key, port.createPlayer(chessSoundUrls[key])])
  ) as Record<BoardSoundKey, AudioPlayerHandle>;
  return { players, boards: 0, owners: new Map() };
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

function warmBank(bank: Bank, handles: readonly PlayFromStartHandle[]): void {
  warmAudioPlayers(
    BOARD_SOUND_KEYS.map((key) => ({
      seekTo: (seconds: number) => bank.players[key].seekTo(seconds),
      play: () => bank.players[key].play(),
      pause: () => {
        if (!bank.owners.has(key)) bank.players[key].pause();
      },
    })),
    handles
  );
}

/** Must run inside a Solid owner (component body / `createRoot`). */
export function createChessBoardSounds(
  enabled: Accessor<boolean>
): ChessMoveSoundPlayer & { readonly cancel: () => void } {
  const port = useAudioPlaybackPort();
  const existing = banks.get(port);
  const bank = existing ?? createBank(port);
  if (existing === undefined) banks.set(port, bank);
  bank.boards += 1;
  let closed = false;
  const owner = Symbol('board-audio');
  const players = Object.fromEntries(
    BOARD_SOUND_KEYS.map((key) => [
      key,
      {
        seekTo: (seconds: number) => bank.players[key].seekTo(seconds),
        pause: () => {
          if (bank.owners.get(key) === owner) bank.players[key].pause();
        },
        play: () => {
          if (closed || !enabled()) return;
          bank.owners.set(key, owner);
          void bank.players[key].play();
        },
      },
    ])
  ) as Record<BoardSoundKey, AudioPlayerHandle>;
  const handles = createPlayFromStartHandles(players);
  const handleList = BOARD_SOUND_KEYS.map((key) => handles[key]);
  const cancel = (): void => {
    for (const key of BOARD_SOUND_KEYS) {
      handles[key].cancel();
      if (bank.owners.get(key) !== owner) continue;
      bank.owners.delete(key);
      try {
        bank.players[key].pause();
      } catch {
        /* A player may already be released. */
      }
    }
  };
  if (existing === undefined) warmBank(bank, handleList);
  createEffect(() => {
    if (!enabled()) cancel();
  });
  onCleanup(() => {
    closed = true;
    cancel();
    releaseBank(port, bank);
  });
  const play = (key: BoardSoundKey): void => {
    if (!closed && enabled()) handles[key].play();
  };
  return {
    cancel,
    playMove: () => play('move'),
    playCapture: () => play('capture'),
    playCheck: () => play('check'),
    playCastle: () => play('castle'),
    playPromote: () => play('promote'),
    playIllegal: () => play('illegal'),
    playGameEnd: () => play('gameEnd'),
  };
}
