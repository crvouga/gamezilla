/**
 * The stateful-resource plan gate (`policy/stateful.rego`), evaluated by
 * conftest against `tofu show -json <plan>`. The runner is injected so the
 * wrapper script and tests share one evaluation path.
 */

export type PlanJson = {
  readonly resource_changes?: readonly {
    readonly address: string;
    readonly mode: 'managed' | 'data';
    readonly type: string;
    readonly change: { readonly actions: readonly string[] };
  }[];
  readonly variables?: Record<string, { readonly value: unknown }>;
  /**
   * Set only on a deliberate teardown (`bun run infra:destroy`): the torn
   * down environment's env-file protection. Not part of `tofu show` output.
   */
  readonly teardown?: { readonly protection: 'production' | 'standard' };
};

export type ConftestRunner = (input: {
  readonly args: readonly string[];
  readonly stdin: string;
}) => {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
};

export type PolicyVerdict = {
  readonly allowed: boolean;
  readonly denials: readonly string[];
};

type ConftestResult = {
  readonly failures?: readonly { readonly msg: string }[];
};

export function evaluatePlanPolicy(
  plan: PlanJson,
  policyDir: string,
  run: ConftestRunner
): PolicyVerdict {
  const result = run({
    args: [
      'test',
      '--policy',
      policyDir,
      '--namespace',
      'main',
      '--output',
      'json',
      '-',
    ],
    stdin: JSON.stringify(plan),
  });
  let parsed: readonly ConftestResult[];
  try {
    parsed = JSON.parse(result.stdout) as readonly ConftestResult[];
  } catch {
    throw new Error(
      `conftest produced no verdict (exit ${String(result.status)}): ${result.stderr}`
    );
  }
  const denials = parsed.flatMap((r) => (r.failures ?? []).map((f) => f.msg));
  if (denials.length === 0 && result.status !== 0) {
    throw new Error(
      `conftest exited ${String(result.status)} without a denial: ${result.stderr}`
    );
  }
  return { allowed: denials.length === 0, denials };
}
