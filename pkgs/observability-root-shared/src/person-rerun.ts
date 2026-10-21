const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

export type RerunQuestion = {
  readonly all?: boolean;
  readonly at: string;
  readonly name: string;
  readonly place?: string;
  readonly sourceFlag?: string;
  readonly windowMs: number;
};

/** `90m`, `2h`: the shortest form `--window` reads. */
export function windowText(windowMs: number): string {
  if (windowMs % HOUR_MS === 0) return `${windowMs / HOUR_MS}h`;
  return `${Math.max(1, Math.round(windowMs / MINUTE_MS))}m`;
}

/** The command that asks the same question, with any part replaced. */
export function rerunCommand(
  question: RerunQuestion,
  change: Partial<RerunQuestion> = {}
): string {
  const asked = { ...question, ...change };
  return [
    'bun obs person',
    `--name ${JSON.stringify(asked.name)}`,
    `--at ${JSON.stringify(asked.at)}`,
    ...(asked.place === undefined
      ? []
      : [`--place ${JSON.stringify(asked.place)}`]),
    `--window ${windowText(asked.windowMs)}`,
    ...(asked.all === true ? ['--all'] : []),
    ...(asked.sourceFlag === undefined ? [] : [`--source ${asked.sourceFlag}`]),
  ].join(' ');
}

/** Twice the window, and never under two hours. */
export function widerWindowMs(windowMs: number): number {
  return Math.max(windowMs * 2, 2 * HOUR_MS);
}
