import type { Logger } from '@gamezilla/lib/logger';

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

export type PuzzleSeedReporter = {
  /** Human heading / machine `log.info` when not pretty. */
  phase(title: string, detail?: Record<string, unknown>): void;
  /** Throttled download bytes (TTY: one `\r` line). */
  downloadProgress(args: {
    receivedBytes: number;
    totalBytes: number | null;
  }): void;
  /** End the in-place download line so following logs start clean. */
  endDownloadProgressLine(): void;
  /** CSV parse row count (TTY: `\r` line). */
  parseProgress(parsedRows: number): void;
  endParseProgressLine(): void;
  /** Structured batch line (always also `log.info` for CI). */
  batchSummary(msg: string, detail: Record<string, unknown>): void;
};

export function createPuzzleSeedReporter(args: {
  pretty: boolean;
  logger: Logger;
}): PuzzleSeedReporter {
  const tty = args.pretty === true && process.stderr.isTTY === true;
  let lastJsonDownloadLog = 0;
  let downloadLineActive = false;
  let parseLineActive = false;

  const writeErr = (s: string): void => {
    process.stderr.write(s);
  };

  const phase = (title: string, detail?: Record<string, unknown>): void => {
    if (tty) {
      const time = new Date().toLocaleTimeString(undefined, {
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
    } else {
      args.logger.info(title, detail);
    }
  };

  const downloadProgress = (p: {
    receivedBytes: number;
    totalBytes: number | null;
  }): void => {
    if (tty) {
      downloadLineActive = true;
      const total = p.totalBytes;
      const frac = total !== null && total > 0 ? p.receivedBytes / total : 0;
      const bar = total !== null ? progressBar(frac, 18) : progressBar(0, 18);
      const pct =
        total !== null && total > 0
          ? `${Math.min(100, (100 * p.receivedBytes) / total).toFixed(1)}%`
          : '…';
      const right = total !== null ? formatBytes(total) : 'unknown size';
      writeErr(
        `\r\x1b[K${ansi.green}↓ download${ansi.reset} ${bar} ${ansi.bold}${formatBytes(p.receivedBytes)}${ansi.reset} / ${right} ${ansi.dim}(${pct})${ansi.reset}`
      );
      return;
    }
    const now = performance.now();
    if (now - lastJsonDownloadLog < 750) return;
    lastJsonDownloadLog = now;
    const pct =
      p.totalBytes !== null && p.totalBytes > 0
        ? Math.round((100 * p.receivedBytes) / p.totalBytes)
        : null;
    args.logger.info('seed:puzzles: download progress', {
      receivedBytes: p.receivedBytes,
      totalBytes: p.totalBytes,
      pct,
    });
  };

  const endDownloadProgressLine = (): void => {
    if (tty && downloadLineActive) {
      writeErr('\n');
      downloadLineActive = false;
    }
  };

  const parseProgress = (parsedRows: number): void => {
    if (tty) {
      parseLineActive = true;
      const n = parsedRows.toLocaleString();
      writeErr(
        `\r\x1b[K${ansi.magenta}⋯ parse CSV${ansi.reset} ${ansi.bold}${n}${ansi.reset} rows read`
      );
      return;
    }
    args.logger.info('seed:puzzles: parse progress', { parsedRows });
  };

  const endParseProgressLine = (): void => {
    if (tty && parseLineActive) {
      writeErr('\n');
      parseLineActive = false;
    }
  };

  const batchSummary = (msg: string, detail: Record<string, unknown>): void => {
    if (tty) {
      const keys = Object.keys(detail);
      writeErr(`\n${ansi.yellow}▸ ${msg}${ansi.reset}`);
      for (const k of keys) {
        const v = detail[k];
        writeErr(
          `\n${ansi.dim}  ${k}:${ansi.reset} ${String(JSON.stringify(v))}`
        );
      }
      writeErr('\n');
    } else {
      args.logger.info(msg, detail);
    }
  };

  return {
    phase,
    downloadProgress,
    endDownloadProgressLine,
    parseProgress,
    endParseProgressLine,
    batchSummary,
  };
}
