export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface Logger {
  debug(msg: string, context?: Record<string, unknown>): void;
  info(msg: string, context?: Record<string, unknown>): void;
  warn(msg: string, context?: Record<string, unknown>): void;
  error(msg: string, context?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

const LEVEL_VALUE: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

export interface CreateLoggerOptions {
  name: string;
  level?: LogLevel;
  /** Epoch ms — required (no wall-clock fallback). */
  now: () => number;
}

let defaultLogLevel: LogLevel = 'debug';

/** Process-wide fallback when `createLogger` is called without `level`. */
export function setDefaultLogLevel(level: LogLevel): void {
  defaultLogLevel = level;
}

export function createLogger(options: CreateLoggerOptions): Logger {
  return buildLogger(
    options.name,
    options.level ?? defaultLogLevel,
    {},
    options.now
  );
}

/** Silent logger for harnesses that need an explicit no-op instance. */
export function createNoopLogger(): Logger {
  return createLogger({ name: 'noop', level: 'silent', now: () => 0 });
}

function buildLogger(
  name: string,
  level: LogLevel,
  bindings: Record<string, unknown>,
  now: () => number
): Logger {
  const threshold = LEVEL_VALUE[level];

  function emit(
    lvl: Exclude<LogLevel, 'silent'>,
    msg: string,
    context?: Record<string, unknown>
  ): void {
    if (LEVEL_VALUE[lvl] < threshold) return;

    const entry = {
      level: lvl,
      time: new Date(now()).toISOString(),
      name,
      msg,
      ...bindings,
      ...context,
    };

    const payload = JSON.stringify(entry);
    switch (lvl) {
      case 'debug':
        // biome-ignore lint/suspicious/noConsole: logger sink writes structured JSON
        console.debug(payload);
        return;
      case 'info':
        // biome-ignore lint/suspicious/noConsole: logger sink writes structured JSON
        console.info(payload);
        return;
      case 'warn':
        console.warn(payload);
        return;
      case 'error':
        console.error(payload);
    }
  }

  return {
    debug: (msg, context) => emit('debug', msg, context),
    info: (msg, context) => emit('info', msg, context),
    warn: (msg, context) => emit('warn', msg, context),
    error: (msg, context) => emit('error', msg, context),
    child: (extra) => buildLogger(name, level, { ...bindings, ...extra }, now),
  };
}
