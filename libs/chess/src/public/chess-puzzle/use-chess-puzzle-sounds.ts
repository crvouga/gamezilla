import { useAudioPlayer } from '@pkgs/sounds/audio-playback/audio-playback-context';
import { chessSoundSources } from '@pkgs/sounds/chess-sound-sources';
import {
  usePlayFromStartHandles,
  useWarmAudioPlayers,
} from '@pkgs/sounds/play-from-start';
import { useMemo, useRef } from 'react';

const PUZZLE_SOUND_KEYS = [
  'solved',
  'eloTick',
  'correctMove',
  'eloCompleteGain',
  'eloCompleteLoss',
] as const;

type PuzzleSoundKey = (typeof PUZZLE_SOUND_KEYS)[number];

export function useChessPuzzleSounds(): {
  playSolved: () => void;
  playEloTick: () => void;
  playEloCompleteGain: () => void;
  playEloCompleteLoss: () => void;
  playCorrectMove: () => void;
} {
  const checkmate = useAudioPlayer(chessSoundSources.puzzleCheckmate);
  const eloTick = useAudioPlayer(chessSoundSources.puzzleEloTick);
  const correctMove = useAudioPlayer(chessSoundSources.puzzleCorrectMove);
  const eloCompleteGain = useAudioPlayer(chessSoundSources.promote);
  const eloCompleteLoss = useAudioPlayer(
    chessSoundSources.puzzleEloCompleteLoss
  );

  const playersRef = useRef({
    solved: checkmate,
    eloTick,
    correctMove,
    eloCompleteGain,
    eloCompleteLoss,
  });
  playersRef.current = {
    solved: checkmate,
    eloTick,
    correctMove,
    eloCompleteGain,
    eloCompleteLoss,
  };

  const handles = usePlayFromStartHandles(PUZZLE_SOUND_KEYS, playersRef);
  const players = useMemo(
    () => [checkmate, eloTick, correctMove, eloCompleteGain, eloCompleteLoss],
    [checkmate, eloTick, correctMove, eloCompleteGain, eloCompleteLoss]
  );
  const handleList = useMemo(
    () => PUZZLE_SOUND_KEYS.map((key: PuzzleSoundKey) => handles[key]),
    [handles]
  );
  useWarmAudioPlayers(players, handleList);

  return useMemo(
    () => ({
      playSolved: handles.solved.play,
      playEloTick: handles.eloTick.play,
      playEloCompleteGain: handles.eloCompleteGain.play,
      playEloCompleteLoss: handles.eloCompleteLoss.play,
      playCorrectMove: handles.correctMove.play,
    }),
    [handles]
  );
}
