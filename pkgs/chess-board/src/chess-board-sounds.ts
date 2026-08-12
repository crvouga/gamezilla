import { useAudioPlayer } from '@pkgs/sounds/audio-playback/audio-playback-context';
import { chessSoundSources } from '@pkgs/sounds/chess-sound-sources';
import {
  usePlayFromStartHandles,
  useWarmAudioPlayers,
} from '@pkgs/sounds/play-from-start';
import { useMemo, useRef } from 'react';

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

export function useChessBoardSounds() {
  const move = useAudioPlayer(chessSoundSources.move);
  const capture = useAudioPlayer(chessSoundSources.capture);
  const check = useAudioPlayer(chessSoundSources.check);
  const castle = useAudioPlayer(chessSoundSources.castle);
  const promote = useAudioPlayer(chessSoundSources.promote);
  const illegal = useAudioPlayer(chessSoundSources.illegal);
  const gameEnd = useAudioPlayer(chessSoundSources.gameEnd);

  const playersRef = useRef({
    move,
    capture,
    check,
    castle,
    promote,
    illegal,
    gameEnd,
  });
  playersRef.current = {
    move,
    capture,
    check,
    castle,
    promote,
    illegal,
    gameEnd,
  };

  const handles = usePlayFromStartHandles(BOARD_SOUND_KEYS, playersRef);
  const players = useMemo(
    () => [move, capture, check, castle, promote, illegal, gameEnd],
    [move, capture, check, castle, promote, illegal, gameEnd]
  );
  const handleList = useMemo(
    () => BOARD_SOUND_KEYS.map((key: BoardSoundKey) => handles[key]),
    [handles]
  );
  useWarmAudioPlayers(players, handleList);

  return useMemo(
    () => ({
      playMove: handles.move.play,
      playCapture: handles.capture.play,
      playCheck: handles.check.play,
      playCastle: handles.castle.play,
      playPromote: handles.promote.play,
      playIllegal: handles.illegal.play,
      playGameEnd: handles.gameEnd.play,
    }),
    [handles]
  );
}

export type ChessBoardSounds = ReturnType<typeof useChessBoardSounds>;
