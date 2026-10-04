import { chessSoundUrls } from '@pkgs/sounds-shared/chess-sound-urls';
import {
  createAudioPlayer,
  createPlayFromStartHandles,
  useSoundsPreference,
  warmAudioPlayers,
} from '@pkgs/sounds-client/solid';
import { createEffect, on } from 'solid-js';

const PUZZLE_SOUND_KEYS = [
  'solved',
  'correctMove',
  'eloCompleteGain',
  'eloCompleteLoss',
] as const;

type PuzzleSoundKey = (typeof PUZZLE_SOUND_KEYS)[number];

export function useChessPuzzleSounds(): {
  playSolved: () => void;
  playEloCompleteGain: () => void;
  playEloCompleteLoss: () => void;
  playCorrectMove: () => void;
} {
  const players: Record<
    PuzzleSoundKey,
    ReturnType<typeof createAudioPlayer>
  > = {
    solved: createAudioPlayer(chessSoundUrls.puzzleCheckmate),
    correctMove: createAudioPlayer(chessSoundUrls.puzzleCorrectMove),
    eloCompleteGain: createAudioPlayer(chessSoundUrls.promote),
    eloCompleteLoss: createAudioPlayer(chessSoundUrls.puzzleEloCompleteLoss),
  };

  const handles = createPlayFromStartHandles(players);
  const preference = useSoundsPreference();
  createEffect(
    on(preference.muted, (muted) => {
      if (muted) for (const key of PUZZLE_SOUND_KEYS) handles[key].cancel();
    })
  );
  warmAudioPlayers(
    PUZZLE_SOUND_KEYS.map((key) => players[key]),
    PUZZLE_SOUND_KEYS.map((key) => handles[key])
  );

  const play = (key: PuzzleSoundKey) => {
    if (!preference.muted()) handles[key].play();
  };
  return {
    playSolved: () => play('solved'),
    playEloCompleteGain: () => play('eloCompleteGain'),
    playEloCompleteLoss: () => play('eloCompleteLoss'),
    playCorrectMove: () => play('correctMove'),
  };
}
