// @io-wall-ok — tools composition root.

/** What a stack is made of, and how to say so on a command line. */

export type StackOptions = {
  /** Names the instance's data directory and manifest file. */
  readonly instanceId: string;
  /** How many API instances sit behind the balancer. */
  readonly apiNodes: number;
  readonly withS3: boolean;
  readonly withEmqx: boolean;
  /** Serve the built web bundle. Off for API-only runs. */
  readonly withWeb: boolean;
  /** Reuse a data directory (and its Postgres cluster) instead of a fresh one. */
  readonly keepData: boolean;
};

function flag(argv: readonly string[], name: string): boolean {
  return argv.includes(`--${name}`);
}

function value(argv: readonly string[], name: string): string | null {
  const prefix = `--${name}=`;
  const hit = argv.find((arg) => arg.startsWith(prefix));
  if (hit !== undefined) return hit.slice(prefix.length);
  const at = argv.indexOf(`--${name}`);
  const next = at >= 0 ? argv[at + 1] : undefined;
  return next !== undefined && !next.startsWith('--') ? next : null;
}

/** Short random suffix keeps concurrent stacks from sharing a data directory. */
function defaultInstanceId(): string {
  return `stack-${crypto.randomUUID().slice(0, 8)}`;
}

export function parseStackOptions(argv: readonly string[]): StackOptions {
  const nodes = Number(value(argv, 'api-nodes') ?? '2');
  return {
    instanceId: value(argv, 'instance') ?? defaultInstanceId(),
    apiNodes: Number.isFinite(nodes) && nodes > 0 ? Math.floor(nodes) : 2,
    withS3: !flag(argv, 'no-s3'),
    withEmqx: !flag(argv, 'no-emqx'),
    withWeb: !flag(argv, 'no-web'),
    keepData: flag(argv, 'keep-data'),
  };
}
