export type PlaybackToggleAction = 'pause' | 'play' | 'restart';

/** How the play button should behave given current transport state. */
export function playbackToggleAction(args: {
  readonly playing: boolean;
  readonly atEnd: boolean;
}): PlaybackToggleAction {
  if (args.playing) return 'pause';
  if (args.atEnd) return 'restart';
  return 'play';
}
