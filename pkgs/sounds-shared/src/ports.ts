export type AudioPlayerHandle = {
  volume: number;
  /** May return a promise (web `HTMLMediaElement.play`) so autoplay blocks can be observed. */
  play: () => void | Promise<void>;
  pause: () => void;
  seekTo: (seconds: number) => Promise<void>;
  replace: (source: unknown) => void;
  remove: () => void;
};

export type AudioPlayerStatus = {
  readonly playing: boolean;
  readonly isLoaded: boolean;
  readonly duration: number;
  readonly currentTime: number;
  readonly didJustFinish: boolean;
};

export type AudioPlaybackPort = {
  readonly createPlayer: (source?: unknown) => AudioPlayerHandle;
  readonly getStatus: (player: AudioPlayerHandle) => AudioPlayerStatus;
  readonly subscribeStatus: (
    player: AudioPlayerHandle,
    listener: (status: AudioPlayerStatus) => void
  ) => () => void;
  readonly setAudioModeAsync?: (mode: unknown) => Promise<void>;
};
