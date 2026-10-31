/** @jsxImportSource solid-js */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';

/** Severity of a log entry. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogLineProps = {
  level: LogLevel;
  /** The time, already formatted (`12:04:05.120`). */
  time: string;
  message: string;
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
};

const LEVEL_TONE: Readonly<Record<LogLevel, string>> = {
  debug: 'text-text-secondary',
  info: 'text-tint',
  warn: 'text-warning',
  error: 'text-destructive',
};

/**
 * `LogLine` -- one entry of a log: its level, the time it was written and
 * its message, in footnote type with a hairline below. Level and time sit
 * in fixed columns so a page of lines scans down the left edge; the message
 * wraps. The level is colored by severity (`error` destructive, `warn`
 * warning, `info` tint, `debug` secondary) and always spelled out, so the
 * color is never the only signal.
 *
 * Stack lines with no gap: each line brings its own rhythm and hairline.
 *
 * @example
 * ```tsx
 * <ScrollView grow>
 *   <For each={entries()}>
 *     {(entry) => <LogLine level={entry.level} time={clock(entry.at)} message={entry.msg} />}
 *   </For>
 * </ScrollView>
 * ```
 */
export function LogLine(props: LogLineProps): JSX.Element {
  return (
    <div
      class="box flex-row items-start gap-ui-sm py-ui-xs border-b border-border"
      data-testid={props.testId}
      data-component={componentId('LogLine')}
      data-level={props.level}
    >
      <span
        class={`text textFootnote textNumeral w-12 shrink-0 ${LEVEL_TONE[props.level]}`}
      >
        {props.level.toUpperCase()}
      </span>
      <span class="text textFootnote textNumeral w-24 shrink-0">
        {props.time}
      </span>
      <span class="text textFootnote text-text flex-1 min-w-0 break-words select-text">
        {props.message}
      </span>
    </div>
  );
}
