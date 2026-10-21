export type ObsArgs = {
  readonly command: string;
  readonly operands: readonly string[];
  readonly flags: Readonly<Record<string, string | true>>;
};

export function parseArgs(argv: readonly string[]): ObsArgs {
  const command = argv[0] ?? 'help';
  const operands: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) continue;
    if (!arg.startsWith('--')) {
      operands.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) {
      flags[key] = true;
    } else {
      flags[key] = next;
      index += 1;
    }
  }
  return { command, operands, flags };
}

export function stringFlag(args: ObsArgs, key: string): string | undefined {
  const value = args.flags[key];
  return typeof value === 'string' ? value : undefined;
}
