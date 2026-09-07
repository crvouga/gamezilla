import { chessSoundUrls } from '@pkgs/sounds/chess-sound-urls';
import {
  createAudioPlayer,
  createPlayFromStartHandles,
  warmAudioPlayers,
} from '@pkgs/sounds/solid';

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
  const players: Record<
    PuzzleSoundKey,
    ReturnType<typeof createAudioPlayer>
  > = {
    solved: createAudioPlayer(chessSoundUrls.puzzleCheckmate),
    eloTick: createAudioPlayer(chessSoundUrls.puzzleEloTick),
    correctMove: createAudioPlayer(chessSoundUrls.puzzleCorrectMove),
    eloCompleteGain: createAudioPlayer(chessSoundUrls.promote),
    eloCompleteLoss: createAudioPlayer(chessSoundUrls.puzzleEloCompleteLoss),
  };

  const handles = createPlayFromStartHandles(players);
  warmAudioPlayers(
    PUZZLE_SOUND_KEYS.map((key) => players[key]),
    PUZZLE_SOUND_KEYS.map((key) => handles[key])
  );

  return {
    playSolved: () => handles.solved.play(),
    playEloTick: () => handles.eloTick.play(),
    playEloCompleteGain: () => handles.eloCompleteGain.play(),
    playEloCompleteLoss: () => handles.eloCompleteLoss.play(),
    playCorrectMove: () => handles.correctMove.play(),
  };
}
