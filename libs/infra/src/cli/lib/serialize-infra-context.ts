import type { InfraContext } from '../resources/types';

/**
 * `InfraContext` is built up by the `provision` phase (zoneId, nameservers)
 * and read by `deploy-resources` and `smoke`. When those phases run as
 * separate GitHub Actions jobs,
 * the context has to round-trip through `job.outputs` — these helpers do
 * the JSON shuttling.
 *
 * Serialization is intentionally tolerant of unknown / extra fields so a
 * downstream job built from an older `provision` output still works during
 * a rolling refactor.
 */
export function serializeInfraContext(ctx: InfraContext): string {
  const out: Record<string, unknown> = {};
  if (ctx.zoneId !== undefined) out['zoneId'] = ctx.zoneId;
  if (ctx.nameservers !== undefined) out['nameservers'] = ctx.nameservers;
  return JSON.stringify(out);
}

export function deserializeInfraContext(
  json: string | undefined | null
): InfraContext {
  if (json === undefined || json === null) return {};
  const trimmed = json.trim();
  if (trimmed === '') return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {};
  }
  const obj = parsed as Record<string, unknown>;
  const ctx: InfraContext = {};
  if (typeof obj['zoneId'] === 'string') ctx.zoneId = obj['zoneId'];
  if (Array.isArray(obj['nameservers'])) {
    const ns = obj['nameservers'].filter(
      (v): v is string => typeof v === 'string'
    );
    ctx.nameservers = ns;
  }
  return ctx;
}

/**
 * Hydrates an `InfraContext` from the `INFRA_CONTEXT` env var (set by the
 * GitHub workflow from `needs.provision.outputs.infra_context`). Returns
 * an empty context locally / when the env is unset, which is fine for the
 * legacy single-process `deploy` command that builds its own context.
 */
export function readInfraContextFromEnv(): InfraContext {
  return deserializeInfraContext(process.env['INFRA_CONTEXT']);
}
