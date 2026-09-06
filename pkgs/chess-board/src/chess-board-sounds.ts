/**
 * Board SFX over the injected `@pkgs/sounds` audio port. Players are created
 * in the calling reactive scope (removed on dispose) and pre-warmed so the
 * first move plays without a decode stall.
 */

import type { ChessMoveSoundPlayer } from '@pkgs/chess-board-core/move-sound';
import { chessSoundUrls } from '@pkgs/sounds/chess-sound-urls';
import {
  createAudioPlayer,
  createPlayFromStartHandles,
  warmAudioPlayers,
} from '@pkgs/sounds/solid';

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

/** Must run inside a Solid owner (component body / `createRoot`). */
export function createChessBoardSounds(): ChessMoveSoundPlayer {
  const players = Object.fromEntries(
    BOARD_SOUND_KEYS.map((key) => [key, createAudioPlayer(chessSoundUrls[key])])
  ) as Record<BoardSoundKey, ReturnType<typeof createAudioPlayer>>;
  const handles = createPlayFromStartHandles(players);
  warmAudioPlayers(
    BOARD_SOUND_KEYS.map((key) => players[key]),
    BOARD_SOUND_KEYS.map((key) => handles[key])
  );
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
