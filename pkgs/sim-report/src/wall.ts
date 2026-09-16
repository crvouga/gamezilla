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
