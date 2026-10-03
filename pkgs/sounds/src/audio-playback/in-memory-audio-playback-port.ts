import type {
  AudioPlaybackPort,
  AudioPlayerHandle,
  AudioPlayerStatus,
} from './ports';

type MemPlayer = AudioPlayerHandle & {
  readonly __status: { current: AudioPlayerStatus };
  __source: unknown;
  readonly __listeners: Set<(s: AudioPlayerStatus) => void>;
};

export type InMemoryAudioPlaybackPort = AudioPlaybackPort & {
  readonly players: () => readonly AudioPlayerHandle[];
  readonly failNext: () => void;
  readonly failNextMatching: (match: (source: unknown) => boolean) => void;
  readonly failures: () => number;
  readonly getSource: (player: AudioPlayerHandle) => unknown;
  readonly setStatus: (
    player: AudioPlayerHandle,
    patch: Partial<AudioPlayerStatus>
  ) => void;
};

function createMemoryPlayer(
  source: unknown,
  emit: (player: MemPlayer) => void
): MemPlayer {
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
    __source: source,
    __status: status,
    __listeners: listeners,
    play() {
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
    replace(source) {
      player.__source = source;
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
  let failWhen: ((source: unknown) => boolean) | null = null;
  let failures = 0;

  function emit(player: MemPlayer): void {
    for (const listener of [...player.__listeners]) {
      listener(player.__status.current);
    }
  }

  return {
    createPlayer(source) {
      if (failWhen?.(source)) {
        failWhen = null;
        failures++;
        throw new Error('in-memory audio: failNext');
      }
      const player = createMemoryPlayer(source, emit);
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
    failNext() {
      failWhen = () => true;
    },
    failNextMatching(match) {
      failWhen = match;
    },
    failures: () => failures,
    getSource(player) {
      return (player as MemPlayer).__source;
    },
    setStatus(player, patch) {
      const mem = player as MemPlayer;
      mem.__status.current = { ...mem.__status.current, ...patch };
      emit(mem);
    },
  };
}
