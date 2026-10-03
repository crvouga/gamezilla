import type {
  AudioPlaybackPort,
  AudioPlayerHandle,
  AudioPlayerStatus,
} from './ports';

type MemPlayer = AudioPlayerHandle & {
  readonly __status: { current: AudioPlayerStatus };
  readonly __listeners: Set<(s: AudioPlayerStatus) => void>;
};

export type InMemoryAudioPlaybackPort = AudioPlaybackPort & {
  readonly players: () => readonly AudioPlayerHandle[];
  /** Actual play calls, including a call later followed by pause or removal. */
  readonly playedSources: () => readonly unknown[];
  readonly failNext: () => void;
  readonly setStatus: (
    player: AudioPlayerHandle,
    patch: Partial<AudioPlayerStatus>
  ) => void;
};

function emit(player: MemPlayer): void {
  for (const listener of [...player.__listeners]) {
    listener(player.__status.current);
  }
}

function createMemoryPlayer(source: unknown, played: unknown[]): MemPlayer {
  let currentSource = source;
  const status: { current: AudioPlayerStatus } = {
    current: {
      playing: false,
      isLoaded: true,
      duration: 1,
      currentTime: 0,
      didJustFinish: false,
    },
  };
  const listeners = new Set<(s: AudioPlayerStatus) => void>();
  const player: MemPlayer = {
    volume: 1,
    __status: status,
    __listeners: listeners,
    play() {
      played.push(currentSource);
      status.current = {
        ...status.current,
        playing: true,
        didJustFinish: false,
      };
      emit(player);
    },
    pause() {
      status.current = { ...status.current, playing: false };
      emit(player);
    },
    async seekTo(seconds) {
      status.current = { ...status.current, currentTime: seconds };
      emit(player);
    },
    replace(next) {
      currentSource = next;
      status.current = {
        ...status.current,
        currentTime: 0,
        didJustFinish: false,
      };
      emit(player);
    },
    remove() {
      status.current = {
        playing: false,
        isLoaded: false,
        duration: 0,
        currentTime: 0,
        didJustFinish: false,
      };
      emit(player);
    },
  };
  return player;
}

/** Harness / test {@link AudioPlaybackPort} with call recording + failNext. */
export function createInMemoryAudioPlaybackPort(): InMemoryAudioPlaybackPort {
  const created: MemPlayer[] = [];
  const played: unknown[] = [];
  let shouldFail = false;

  return {
    createPlayer(source) {
      if (shouldFail) {
        shouldFail = false;
        throw new Error('in-memory audio: failNext');
      }
      const player = createMemoryPlayer(source, played);
      created.push(player);
      return player;
    },
    getStatus(player) {
      return (player as MemPlayer).__status.current;
    },
    subscribeStatus(player, listener) {
      const mem = player as MemPlayer;
      mem.__listeners.add(listener);
      listener(mem.__status.current);
      return () => {
        mem.__listeners.delete(listener);
      };
    },
    async setAudioModeAsync() {
      return undefined;
    },
    players() {
      return created;
    },
    playedSources() {
      return [...played];
    },
    failNext() {
      shouldFail = true;
    },
    setStatus(player, patch) {
      const mem = player as MemPlayer;
      mem.__status.current = { ...mem.__status.current, ...patch };
      emit(mem);
    },
  };
}
