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

function writeErr(s: string): void {
  process.stderr.write(s);
}

function createTtyReporter(): PuzzleSeedReporter {
  let downloadLineActive = false;
  let parseLineActive = false;

  const phase = (title: string, detail?: Record<string, unknown>): void => {
    const time = new Date().toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    writeErr(
      `\n${ansi.dim}${time}${ansi.reset} ${ansi.bold}${ansi.cyan}${title}${ansi.reset}`
    );
    if (detail !== undefined && Object.keys(detail).length > 0) {
      writeErr(`\n${ansi.dim}${JSON.stringify(detail, null, 2)}${ansi.reset}`);
    }
    writeErr('\n');
  };

  const downloadProgress = (p: {
    receivedBytes: number;
    totalBytes: number | null;
  }): void => {
    downloadLineActive = true;
    const total = p.totalBytes;
    const bar = progressBar(downloadFraction(p.receivedBytes, total), 18);
    const pct = downloadPercentLabel(p.receivedBytes, total);
    const right = total !== null ? formatBytes(total) : 'unknown size';
    writeErr(
      `\r\x1b[K${ansi.green}↓ download${ansi.reset} ${bar} ${ansi.bold}${formatBytes(p.receivedBytes)}${ansi.reset} / ${right} ${ansi.dim}(${pct})${ansi.reset}`
    );
  };

  const endDownloadProgressLine = (): void => {
    if (downloadLineActive) {
      writeErr('\n');
      downloadLineActive = false;
    }
  };

  const parseProgress = (parsedRows: number): void => {
    parseLineActive = true;
    writeErr(
      `\r\x1b[K${ansi.magenta}⋯ parse CSV${ansi.reset} ${ansi.bold}${parsedRows.toLocaleString()}${ansi.reset} rows read`
    );
  };

  const endParseProgressLine = (): void => {
    if (parseLineActive) {
      writeErr('\n');
      parseLineActive = false;
    }
  };

  const batchSummary = (msg: string, detail: Record<string, unknown>): void => {
    writeErr(`\n${ansi.yellow}▸ ${msg}${ansi.reset}`);
    for (const k of Object.keys(detail)) {
      writeErr(
        `\n${ansi.dim}  ${k}:${ansi.reset} ${String(JSON.stringify(detail[k]))}`
      );
    }
    writeErr('\n');
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

function createJsonReporter(logger: Logger): PuzzleSeedReporter {
  let lastJsonDownloadLog = 0;
  return {
    phase: (title, detail) => logger.info(title, detail),
    downloadProgress: (p) => {
      const now = performance.now();
      if (now - lastJsonDownloadLog < 750) return;
      lastJsonDownloadLog = now;
      logger.info('seed:puzzles: download progress', {
        receivedBytes: p.receivedBytes,
        totalBytes: p.totalBytes,
        pct: downloadIntegerPercent(p.receivedBytes, p.totalBytes),
      });
    },
    endDownloadProgressLine: () => undefined,
    parseProgress: (parsedRows) =>
      logger.info('seed:puzzles: parse progress', { parsedRows }),
    endParseProgressLine: () => undefined,
    batchSummary: (msg, detail) => logger.info(msg, detail),
  };
}

export function createPuzzleSeedReporter(args: {
  pretty: boolean;
  logger: Logger;
}): PuzzleSeedReporter {
  const tty = args.pretty === true && process.stderr.isTTY === true;
  return tty ? createTtyReporter() : createJsonReporter(args.logger);
}
