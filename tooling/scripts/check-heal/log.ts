function timestamp(): string {
  return new Date().toISOString();
}

export function healLog(message: string): void {
  process.stderr.write(`[check:heal ${timestamp()}] ${message}\n`);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${String(ms)}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const min = Math.floor(sec / 60);
  const rem = sec - min * 60;
  return `${String(min)}m ${rem.toFixed(0)}s`;
}
