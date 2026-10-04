import type {
  AudioPlaybackPort,
  AudioPlayerHandle,
  AudioPlayerStatus,
} from '@pkgs/sounds-shared/ports';
import {
  isAutoplayBlockedError,
  isReleasedSharedObjectError,
} from '@pkgs/sounds-shared/safe-audio-play';

export type TtsPlayerSnapshot = {
  readonly isPlaying: boolean;
  readonly currentUrl: string | null;
  /** Total audio length in ms, or `null` until the player reports a duration. */
  readonly durationMs: number | null;
};

export type TtsPlayerController = {
  readonly getSnapshot: () => TtsPlayerSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
  readonly play: (url: string) => Promise<void>;
  readonly stop: () => void;
  readonly dispose: () => void;
};

function isIgnorablePlayError(error: unknown): boolean {
  return isAutoplayBlockedError(error) || isReleasedSharedObjectError(error);
}

/**
 * Framework-free playback state machine for TTS-served URLs over an
 * {@link AudioPlaybackPort}. `isPlaying` is true while the port reports
 * `playing` **or** for the lead-in window right after `play()` is issued,
 * so UI can align with audio starting instead of lagging a status tick.
 *
 * `play(url)` swaps the source, waits for `isLoaded`, seeks to 0, then plays.
 * `stop()` clears the requested URL so a queued autoplay from an in-flight
 * load / seek bails out instead of resuming audio after the pause.
 */
class TtsPlayerControllerImpl implements TtsPlayerController {
  private readonly listeners = new Set<() => void>();
  private player: AudioPlayerHandle | null = null;
  private unsubscribeStatus: (() => void) | null = null;
  private status: AudioPlayerStatus | null = null;
  private currentUrl: string | null = null;
  private requestedUrl: string | null = null;
  private requestVersion = 0;
  /** Request whose seek is in flight, including repeated URLs. */
  private seekingVersion: number | null = null;
  private playingLeadIn = false;
  private snapshot: TtsPlayerSnapshot = {
    isPlaying: false,
    currentUrl: null,
    durationMs: null,
  };

  constructor(private readonly audio: AudioPlaybackPort) {}

  readonly getSnapshot = (): TtsPlayerSnapshot => this.snapshot;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly play = async (url: string): Promise<void> => {
    const version = ++this.requestVersion;
    const target = this.ensurePlayer();
    this.requestedUrl = url;
    if (this.currentUrl === url) {
      await target.seekTo(0);
      if (this.requestVersion !== version || this.requestedUrl !== url) return;
      this.issuePlay(target);
      this.requestedUrl = null;
      return;
    }
    this.currentUrl = url;
    this.status = null;
    target.replace({ uri: url });
    this.notify();
    const loaded = this.audio.getStatus(target);
    if (loaded.isLoaded) this.onStatus(loaded);
  };

  readonly stop = (): void => {
    this.requestVersion += 1;
    this.requestedUrl = null;
    this.playingLeadIn = false;
    if (this.player !== null && this.currentUrl !== null) {
      try {
        this.player.pause();
      } catch {
        // Player may already be disposed (fast unmount / source swap).
      }
    }
    this.notify();
  };

  readonly dispose = (): void => {
    this.requestVersion += 1;
    this.requestedUrl = null;
    this.unsubscribeStatus?.();
    this.unsubscribeStatus = null;
    try {
      this.player?.remove();
    } catch {
      // Released player races.
    }
    this.player = null;
    this.listeners.clear();
  };

  private notify(): void {
    const duration = this.status?.duration ?? 0;
    this.snapshot = {
      isPlaying: (this.status?.playing ?? false) || this.playingLeadIn,
      currentUrl: this.currentUrl,
      durationMs: duration > 0 ? Math.round(duration * 1000) : null,
    };
    for (const listener of [...this.listeners]) listener();
  }

  private ensurePlayer(): AudioPlayerHandle {
    if (this.player !== null) return this.player;
    const player = this.audio.createPlayer(undefined);
    this.player = player;
    this.unsubscribeStatus = this.audio.subscribeStatus(player, (status) =>
      this.onStatus(status)
    );
    this.status = this.audio.getStatus(player);
    return player;
  }

  private onStatus(next: AudioPlayerStatus): void {
    this.status = next;
    if (next.playing) this.playingLeadIn = false;
    const url = this.requestedUrl;
    if (
      url !== null &&
      url === this.currentUrl &&
      this.seekingVersion !== this.requestVersion &&
      next.isLoaded &&
      this.player !== null
    ) {
      this.seekThenPlay(this.player, url);
    }
    this.notify();
  }

  private seekThenPlay(target: AudioPlayerHandle, url: string): void {
    const version = this.requestVersion;
    this.seekingVersion = version;
    void target.seekTo(0).finally(() => {
      if (this.seekingVersion === version) this.seekingVersion = null;
      if (this.requestVersion !== version || this.requestedUrl !== url) return;
      this.issuePlay(target);
      this.requestedUrl = null;
    });
  }

  private issuePlay(target: AudioPlayerHandle): void {
    this.playingLeadIn = true;
    this.notify();
    const clearLeadIn = (): void => {
      this.playingLeadIn = false;
      this.notify();
    };
    try {
      const result = target.play();
      if (result !== undefined && typeof result.then === 'function') {
        void result.catch((error: unknown) => {
          if (!isIgnorablePlayError(error)) throw error;
          clearLeadIn();
        });
      }
    } catch (error) {
      if (!isIgnorablePlayError(error)) throw error;
      clearLeadIn();
    }
  }
}

export function createTtsPlayerController(args: {
  readonly audio: AudioPlaybackPort;
}): TtsPlayerController {
  return new TtsPlayerControllerImpl(args.audio);
}
