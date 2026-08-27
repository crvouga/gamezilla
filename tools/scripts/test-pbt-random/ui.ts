import { basename } from 'node:path';

import type { FileRunResult } from './run-file';

const SPINNER_FRAMES = [
  '⠋',
  '⠙',
  '⠹',
  '⠸',
  '⠼',
  '⠴',
  '⠦',
  '⠧',
  '⠇',
  '⠏',
] as const;

const ansi = {
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
};

/**
 * Clip styled text so its visible width (ANSI escapes excluded) never exceeds
 * maxWidth, including the trailing ellipsis. Lines wider than the terminal
 * would soft-wrap onto extra rows and desync the cursor-up redraw math.
 */
function truncateToWidth(text: string, maxWidth: number): string {
  if (maxWidth <= 1) return text;
  const budget = maxWidth - 1;
  let visible = 0;
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\x1b') {
      const end = text.indexOf('m', i);
      if (end === -1) break;
      out += text.slice(i, end + 1);
      i = end;
      continue;
    }
    if (visible >= budget) {
      return `${out}\x1b[0m…`;
    }
    out += text[i];
    visible += 1;
  }
  return out;
}

export type PbtSessionOptions = {
  readonly totalFiles: number;
  readonly concurrency: number;
  readonly numRuns: number;
  readonly attempts: number;
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${String(ms)}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const min = Math.floor(sec / 60);
  const rem = sec - min * 60;
  return `${String(min)}m ${rem.toFixed(0)}s`;
}

function shortName(file: string): string {
  const name = basename(file);
  return name.length > 44 ? `…${name.slice(-43)}` : name;
}

function progressBar(done: number, total: number, width = 24): string {
  if (total <= 0) return ansi.dim('[' + '·'.repeat(width) + ']');
  const filled = Math.min(width, Math.round((done / total) * width));
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  return ansi.cyan(`[${bar}]`);
}

export class PbtSessionUi {
  private readonly useTty: boolean;
  private spinnerIndex = 0;
  private spinnerTimer: ReturnType<typeof setInterval> | null = null;
  private renderLines = 0;
  private renderLock = false;
  private renderQueued = false;

  private attempt = 1;
  private seed = 0;
  private passed = 0;
  private failed = 0;
  private running = new Set<string>();
  private lastCompleted: { readonly file: string; readonly ms: number } | null =
    null;
  private attemptStarted = 0;
  private sessionStarted = 0;
  private attemptsPassed = 0;

  constructor(private readonly options: PbtSessionOptions) {
    this.useTty = Boolean(process.stdout.isTTY);
  }

  startSession(): void {
    this.sessionStarted = Date.now();
    if (this.useTty) {
      process.stdout.write('\x1b[?25l');
      this.spinnerTimer = setInterval(() => {
        this.spinnerIndex = (this.spinnerIndex + 1) % SPINNER_FRAMES.length;
        this.scheduleRender();
      }, 100);
    } else {
      process.stdout.write(
        `${ansi.bold('PBT random suite')} — ${String(this.options.totalFiles)} files, ${String(this.options.concurrency)} workers, ${String(this.options.numRuns)} runs/property\n`
      );
    }
  }

  stopSession(): void {
    this.stopSpinner();
    this.clearRendered();
    if (this.useTty) {
      process.stdout.write('\x1b[?25h\n');
    }
    const elapsed = formatDuration(Date.now() - this.sessionStarted);
    if (this.options.attempts > 1) {
      process.stdout.write(
        `${ansi.green('✓')} ${String(this.attemptsPassed)}/${String(this.options.attempts)} attempts passed ${ansi.dim(`(${elapsed})`)}\n`
      );
    }
  }

  beginAttempt(attempt: number, seed: number): void {
    this.attempt = attempt;
    this.seed = seed;
    this.passed = 0;
    this.failed = 0;
    this.running.clear();
    this.lastCompleted = null;
    this.attemptStarted = Date.now();
    this.scheduleRender();
  }

  markRunning(file: string): void {
    this.running.add(file);
    this.scheduleRender();
  }

  markDone(result: FileRunResult): void {
    this.running.delete(result.file);
    if (result.code === 0) {
      this.passed += 1;
    } else {
      this.failed += 1;
    }
    this.lastCompleted = { file: result.file, ms: result.durationMs };
    this.scheduleRender();
  }

  endAttempt(ok: boolean): void {
    if (ok) this.attemptsPassed += 1;
    if (!this.useTty) {
      const label =
        this.options.attempts === 1
          ? 'suite'
          : `attempt ${String(this.attempt)}/${String(this.options.attempts)}`;
      const glyph = ok ? ansi.green('✓') : ansi.red('✗');
      process.stdout.write(
        `  ${glyph} ${label} seed=${String(this.seed)} ${formatDuration(Date.now() - this.attemptStarted)}\n`
      );
      return;
    }
    this.scheduleRender();
  }

  printFailures(results: readonly FileRunResult[]): void {
    const failed = results.filter((r) => r.code !== 0);
    if (failed.length === 0) return;
    this.stopSpinner();
    this.clearRendered();
    if (this.useTty) {
      process.stdout.write('\x1b[?25h\n');
    }
    process.stderr.write(
      `\n${ansi.red(ansi.bold('Failures'))} ${ansi.dim(`seed ${String(this.seed)}`)}\n`
    );
    for (const result of failed) {
      process.stderr.write(
        `\n${ansi.bold('──')} ${result.file} ${ansi.dim(`(exit ${String(result.code)})`)}\n`
      );
      if (result.stdout.length > 0) {
        process.stderr.write(result.stdout);
        if (!result.stdout.endsWith('\n')) process.stderr.write('\n');
      }
      if (result.stderr.length > 0) {
        process.stderr.write(result.stderr);
        if (!result.stderr.endsWith('\n')) process.stderr.write('\n');
      }
    }
    process.stderr.write(
      `\n${ansi.dim('Replay:')} FC_SEED=${String(this.seed)} bun test <file>\n`
    );
  }

  private stopSpinner(): void {
    if (this.spinnerTimer !== null) {
      clearInterval(this.spinnerTimer);
      this.spinnerTimer = null;
    }
  }

  private scheduleRender(): void {
    if (!this.useTty) return;
    if (this.renderLock) {
      this.renderQueued = true;
      return;
    }
    this.renderLock = true;
    this.doRender();
    this.renderLock = false;
    if (this.renderQueued) {
      this.renderQueued = false;
      this.scheduleRender();
    }
  }

  private buildLines(): string[] {
    const frame = SPINNER_FRAMES[this.spinnerIndex] ?? SPINNER_FRAMES[0];
    const { concurrency, numRuns, attempts, totalFiles } = this.options;
    const done = this.passed + this.failed;
    const elapsed = formatDuration(Date.now() - this.attemptStarted);

    const attemptPart =
      attempts === 1
        ? ''
        : `  ${ansi.dim('attempt')} ${ansi.bold(`${String(this.attempt)}/${String(attempts)}`)}`;

    const header =
      `${ansi.bold('PBT random')}${attemptPart}` +
      `  ${ansi.dim('seed')} ${ansi.yellow(String(this.seed))}` +
      `  ${ansi.dim('workers')} ${String(concurrency)}` +
      `  ${ansi.dim('runs')} ${String(numRuns)}`;

    const progress =
      `${progressBar(done, totalFiles)} ${ansi.bold(`${String(done)}/${String(totalFiles)}`)}` +
      `  ${ansi.green(`✓${String(this.passed)}`)}` +
      (this.failed > 0 ? ` ${ansi.red(`✗${String(this.failed)}`)}` : '') +
      `  ${ansi.dim(elapsed)}`;

    const runningNames = [...this.running].map(shortName);
    let active: string;
    if (runningNames.length === 0 && done < totalFiles) {
      active = `  ${ansi.cyan(frame)} ${ansi.dim('starting…')}`;
    } else if (runningNames.length === 0) {
      active = `  ${ansi.green('✓')} ${ansi.dim('idle')}`;
    } else {
      const shown = runningNames.slice(0, concurrency);
      const extra =
        runningNames.length > shown.length
          ? ansi.dim(` +${String(runningNames.length - shown.length)}`)
          : '';
      active =
        `  ${ansi.cyan(frame)} ${ansi.dim('running')} ` +
        shown.map((n) => ansi.cyan(n)).join(ansi.dim(', ')) +
        extra;
    }

    const last =
      this.lastCompleted === null
        ? `  ${ansi.dim('last —')}`
        : `  ${ansi.dim('last')} ${ansi.green('✓')} ${ansi.dim(shortName(this.lastCompleted.file))} ${ansi.dim(formatDuration(this.lastCompleted.ms))}`;

    // Clip every line strictly under the terminal width so none soft-wraps.
    const maxWidth = Math.max(20, (process.stdout.columns ?? 80) - 1);
    return [header, progress, active, last].map((line) =>
      truncateToWidth(line, maxWidth)
    );
  }

  private doRender(): void {
    const lines = this.buildLines();
    // Move to the top of the previous frame, erase it and everything below,
    // then draw the new frame in one write to avoid flicker.
    const moveUp =
      this.renderLines > 0 ? `\x1b[${String(this.renderLines)}A` : '';
    process.stdout.write(
      `${moveUp}\x1b[G\x1b[0J${lines.map((line) => `${line}\n`).join('')}`
    );
    this.renderLines = lines.length;
  }

  private clearRendered(): void {
    if (!this.useTty || this.renderLines === 0) return;
    process.stdout.write(`\x1b[${String(this.renderLines)}A\x1b[G\x1b[0J`);
    this.renderLines = 0;
  }
}
