// @io-wall-ok — standalone HTML report play scrubber uses wall timers
let playTimer: ReturnType<typeof setInterval> | null = null;

export function isPlaying(): boolean {
  return playTimer !== null;
}

export function stopPlayTimer(): void {
  if (playTimer !== null) {
    clearInterval(playTimer);
    playTimer = null;
  }
}

export function startPlayTimer(tick: () => void): void {
  stopPlayTimer();
  playTimer = setInterval(tick, 700);
}

let hashTimer: ReturnType<typeof setTimeout> | null = null;

/** Cancel a pending debounced task scheduled with {@link debounceHash}. */
export function cancelHashWrite(): void {
  if (hashTimer !== null) {
    clearTimeout(hashTimer);
    hashTimer = null;
  }
}

/** Trailing debounce for URL hash writes (Safari throttles replaceState). */
export function debounceHash(write: () => void, delayMs: number): void {
  cancelHashWrite();
  hashTimer = setTimeout(() => {
    hashTimer = null;
    write();
  }, delayMs);
}
