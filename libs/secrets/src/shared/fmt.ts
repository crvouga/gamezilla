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
  process.stdout.write('\n');
  process.stdout.write(`${fmt.dim(rule)}\n`);
  process.stdout.write(
    `  ${fmt.bold(text)}${timeStr ? fmt.dim(timeStr) : ''}\n`
  );
  process.stdout.write(`${fmt.dim(rule)}\n`);
}

export function heading(text: string): void {
  process.stdout.write(`\n${fmt.bold(fmt.cyan(text))}\n`);
}

export function step(label: string): void {
  process.stdout.write(`${fmt.cyan('●')} ${label}...`);
}

export function stepDone(label: string, ms: number): void {
  process.stdout.write(
    `${fmt.green('●')} ${label} ${fmt.dim(`(${fmtMs(ms)})`)}\n`
  );
}

export function stepFail(label: string, ms: number): void {
  process.stdout.write(
    `${fmt.red('✗')} ${label} ${fmt.dim(`(${fmtMs(ms)})`)}\n`
  );
}

export function ok(label: string, detail?: string): void {
  const d = detail ? ` ${fmt.dim('—')} ${detail}` : '';
  process.stdout.write(`${fmt.green('✓')} ${label}${d}\n`);
}

export function fail(label: string, detail?: string): void {
  const d = detail ? ` ${fmt.dim('—')} ${detail}` : '';
  process.stdout.write(`${fmt.red('✗')} ${label}${d}\n`);
}

export function warn(label: string, detail?: string): void {
  const d = detail ? ` ${fmt.dim('—')} ${detail}` : '';
  process.stdout.write(`${fmt.yellow('⚠')} ${label}${d}\n`);
}

export function info(label: string, detail?: string): void {
  const d = detail ? ` ${fmt.dim('—')} ${detail}` : '';
  process.stdout.write(`${fmt.dim('·')} ${label}${d}\n`);
}

export function kv(key: string, value: string): void {
  process.stdout.write(`  ${fmt.dim(`${key}:`)} ${value}\n`);
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
