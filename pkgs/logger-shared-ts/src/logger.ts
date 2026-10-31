export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_EVENT_BRIDGE = Symbol.for('@pkgs/observability.log-event');

type CorrelatedLogRecorder = (event: {
  readonly severity: Exclude<LogLevel, 'silent'>;
  readonly message: string;
  readonly loggerName: string;
  readonly context?: Readonly<Record<string, unknown>>;
}) => void;

function recordCorrelatedLog(
  event: Parameters<CorrelatedLogRecorder>[0]
): void {
  const host = globalThis as {
    [LOG_EVENT_BRIDGE]?: CorrelatedLogRecorder;
  };
  host[LOG_EVENT_BRIDGE]?.(event);
}

export interface Logger {
  debug(msg: string, context?: Record<string, unknown>): void;
  info(msg: string, context?: Record<string, unknown>): void;
  warn(msg: string, context?: Record<string, unknown>): void;
  error(msg: string, context?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

export type LogSink = {
  debug(payload: string): void;
  info(payload: string): void;
  warn(payload: string): void;
  error(payload: string): void;
};

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
  readonly sink?: LogSink;
}

let defaultLogLevel: LogLevel = 'debug';

/** Process-wide fallback when `createLogger` is called without `level`. */
export function setDefaultLogLevel(level: LogLevel): void {
  defaultLogLevel = level;
}

export function createLogger(options: CreateLoggerOptions): Logger {
  return buildLogger({
    name: options.name,
    level: options.level ?? defaultLogLevel,
    bindings: {},
    now: options.now,
    sink: options.sink ?? console,
  });
}

/** Silent logger for harnesses that need an explicit no-op instance. */
export function createNoopLogger(): Logger {
  return createLogger({ name: 'noop', level: 'silent', now: () => 0 });
}

type BuildLoggerOptions = {
  readonly name: string;
  readonly level: LogLevel;
  readonly bindings: Record<string, unknown>;
  readonly now: () => number;
  readonly sink: LogSink;
};

function buildLogger(options: BuildLoggerOptions): Logger {
  const threshold = LEVEL_VALUE[options.level];

  function emit(
    lvl: Exclude<LogLevel, 'silent'>,
    msg: string,
    context?: Record<string, unknown>
  ): void {
    if (LEVEL_VALUE[lvl] < threshold) return;

    const error = context?.['error'] ?? options.bindings['error'];
    recordCorrelatedLog({
      severity: lvl,
      message: msg,
      loggerName: options.name,
      ...(error instanceof Error || typeof error === 'string'
        ? { context: { error } }
        : {}),
    });

    const entry = {
      level: lvl,
      time: new Date(options.now()).toISOString(),
      name: options.name,
      msg,
      ...options.bindings,
      ...context,
    };

    const payload = JSON.stringify(entry);
    switch (lvl) {
      case 'debug':
        options.sink.debug(payload);
        return;
      case 'info':
        options.sink.info(payload);
        return;
      case 'warn':
        options.sink.warn(payload);
        return;
      case 'error':
        options.sink.error(payload);
    }
  }

  return {
    debug: (msg, context) => emit('debug', msg, context),
    info: (msg, context) => emit('info', msg, context),
    warn: (msg, context) => emit('warn', msg, context),
    error: (msg, context) => emit('error', msg, context),
    child: (extra) =>
      buildLogger({
        ...options,
        bindings: { ...options.bindings, ...extra },
      }),
  };
}
