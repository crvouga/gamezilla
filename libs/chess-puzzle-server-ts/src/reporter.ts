import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { Logger } from '@pkgs/logger-shared-ts/logger';

const ansi = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
};

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KiB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MiB`;
  return `${(n / 1024 ** 3).toFixed(2)} GiB`;
}

function progressBar(fraction: number, width: number): string {
  const f = Math.max(0, Math.min(1, fraction));
  const filled = Math.round(f * width);
  return `[${'='.repeat(filled)}${' '.repeat(width - filled)}]`;
}

function downloadFraction(received: number, total: number | null): number {
  return total !== null && total > 0 ? received / total : 0;
}

function downloadPercentLabel(received: number, total: number | null): string {
  if (total === null || total <= 0) return '…';
  return `${Math.min(100, (100 * received) / total).toFixed(1)}%`;
}

function downloadIntegerPercent(
  received: number,
  total: number | null
): number | null {
  if (total === null || total <= 0) return null;
  return Math.round((100 * received) / total);
}

function writeErr(s: string): void {
  process.stderr.write(s);
}

export class PuzzleSeedReporter {
  readonly #now: Clock['now'];
  readonly #logger: Logger;
  readonly #tty: boolean;
  #downloadLineActive = false;
  #parseLineActive = false;
  #lastJsonDownloadLog = 0;

  constructor(args: {
    pretty: boolean;
    logger: Logger;
    now: Clock['now'];
  }) {
    this.#now = args.now;
    this.#logger = args.logger;
    this.#tty = args.pretty === true && process.stderr.isTTY === true;
  }

  /** Human heading / machine `log.info` when not pretty. */
  phase(title: string, detail?: Record<string, unknown>): void {
    if (this.#tty) {
      const time = new Date(this.#now()).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      writeErr(
        `\n${ansi.dim}${time}${ansi.reset} ${ansi.bold}${ansi.cyan}${title}${ansi.reset}`
      );
      if (detail !== undefined && Object.keys(detail).length > 0) {
        writeErr(
          `\n${ansi.dim}${JSON.stringify(detail, null, 2)}${ansi.reset}`
        );
      }
      writeErr('\n');
      return;
    }
    this.#logger.info(title, detail);
  }

  /** Throttled download bytes (TTY: one `\r` line). */
  downloadProgress(args: {
    receivedBytes: number;
    totalBytes: number | null;
  }): void {
    if (this.#tty) {
      this.#downloadLineActive = true;
      const total = args.totalBytes;
      const bar = progressBar(downloadFraction(args.receivedBytes, total), 18);
      const pct = downloadPercentLabel(args.receivedBytes, total);
      const right = total !== null ? formatBytes(total) : 'unknown size';
      writeErr(
        `\r\x1b[K${ansi.green}↓ download${ansi.reset} ${bar} ${ansi.bold}${formatBytes(args.receivedBytes)}${ansi.reset} / ${right} ${ansi.dim}(${pct})${ansi.reset}`
      );
      return;
    }
    const t = this.#now();
    if (t - this.#lastJsonDownloadLog < 750) return;
    this.#lastJsonDownloadLog = t;
    this.#logger.info('seed:puzzles: download progress', {
      receivedBytes: args.receivedBytes,
      totalBytes: args.totalBytes,
      pct: downloadIntegerPercent(args.receivedBytes, args.totalBytes),
    });
  }

  /** End the in-place download line so following logs start clean. */
  endDownloadProgressLine(): void {
    if (this.#tty && this.#downloadLineActive) {
      writeErr('\n');
      this.#downloadLineActive = false;
    }
  }

  /** CSV parse row count (TTY: `\r` line). */
  parseProgress(parsedRows: number): void {
    if (this.#tty) {
      this.#parseLineActive = true;
      writeErr(
        `\r\x1b[K${ansi.magenta}⋯ parse CSV${ansi.reset} ${ansi.bold}${parsedRows.toLocaleString()}${ansi.reset} rows read`
      );
      return;
    }
    this.#logger.info('seed:puzzles: parse progress', { parsedRows });
  }

  endParseProgressLine(): void {
    if (this.#tty && this.#parseLineActive) {
      writeErr('\n');
      this.#parseLineActive = false;
    }
  }

  /** Structured batch line (always also `log.info` for CI). */
  batchSummary(msg: string, detail: Record<string, unknown>): void {
    if (this.#tty) {
      writeErr(`\n${ansi.yellow}▸ ${msg}${ansi.reset}`);
      for (const k of Object.keys(detail)) {
        writeErr(
          `\n${ansi.dim}  ${k}:${ansi.reset} ${String(JSON.stringify(detail[k]))}`
        );
      }
      writeErr('\n');
      return;
    }
    this.#logger.info(msg, detail);
  }
}
