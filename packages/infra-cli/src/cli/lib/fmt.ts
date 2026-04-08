import pc from 'picocolors';

export const fmt = {
  bold: pc.bold,
  dim: pc.dim,
  green: pc.green,
  red: pc.red,
  yellow: pc.yellow,
  cyan: pc.cyan,
  magenta: pc.magenta,
} as const;

export function banner(text: string, elapsedMs?: number): void {
  const timeStr = elapsedMs !== undefined ? ` (${fmtMs(elapsedMs)})` : '';
  const lineLen = Math.max(text.length + timeStr.length + 4, 40);
  const rule = '─'.repeat(lineLen);
  console.log('');
  console.log(fmt.dim(rule));
  console.log(`  ${fmt.bold(text)}${timeStr ? fmt.dim(timeStr) : ''}`);
  console.log(fmt.dim(rule));
}

export function heading(text: string): void {
  console.log(`\n${fmt.bold(fmt.cyan(text))}`);
}

export function step(label: string): void {
  process.stdout.write(`${fmt.cyan('●')} ${label}...`);
}

export function stepDone(label: string, ms: number): void {
  console.log(`${fmt.green('●')} ${label} ${fmt.dim(`(${fmtMs(ms)})`)}`);
}

export function stepFail(label: string, ms: number): void {
  console.log(`${fmt.red('✗')} ${label} ${fmt.dim(`(${fmtMs(ms)})`)}`);
}

export function ok(label: string, detail?: string): void {
  const d = detail ? ` ${fmt.dim('—')} ${detail}` : '';
  console.log(`${fmt.green('✓')} ${label}${d}`);
}

export function fail(label: string, detail?: string): void {
  const d = detail ? ` ${fmt.dim('—')} ${detail}` : '';
  console.log(`${fmt.red('✗')} ${label}${d}`);
}

export function warn(label: string, detail?: string): void {
  const d = detail ? ` ${fmt.dim('—')} ${detail}` : '';
  console.log(`${fmt.yellow('⚠')} ${label}${d}`);
}

export function info(label: string, detail?: string): void {
  const d = detail ? ` ${fmt.dim('—')} ${detail}` : '';
  console.log(`${fmt.dim('·')} ${label}${d}`);
}

export function kv(key: string, value: string): void {
  console.log(`  ${fmt.dim(key + ':')} ${value}`);
}

export function fmtMs(ms: number): string {
  if (ms < 1_000) return `${Math.round(ms)}ms`;
  const s = ms / 1_000;
  if (s < 120) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m${Math.round(s % 60)}s`;
}

export function fmtElapsed(ms: number): string {
  return fmtMs(ms);
}
