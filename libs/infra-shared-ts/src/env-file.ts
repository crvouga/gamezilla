/**
 * The environment file (`tofu/envs/<env>.tfvars.json`): the only place an
 * environment's identity lives. Both stacks read it, resolved
 * (`tofu-vars.ts`), as a `-var-file`; this schema mirrors their
 * `variables.tf` so `bun verify` can validate every env file — and the
 * invariants OpenTofu cannot express across files — without credentials.
 */
import { z } from 'zod';
import { GITHUB_REPOSITORY, GLOBAL } from './global';
import { resolveEnvVars } from './tofu-vars';

const slug = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);
const hostname = z
  .string()
  .regex(/^(?=.{1,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/, 'must be a lowercase FQDN');
const id = z.string().min(1);

export const envFileSchema = z
  .object({
    env: slug,
    display_name: z.string().min(1),
    suffix: slug,
    worker: z
      .object({
        name: slug,
        admin_name: slug,
        transfer_rooms_from: slug.optional(),
        room_namespace_resolution: z
          .object({ source_id: id, target_id: id })
          .strict()
          .optional(),
        retire: z.array(slug).default([]),
        admin_account_ids: z.array(id).default([]),
      })
      .strict(),
    protection: z.enum(['production', 'standard']),
    cloudflare: z.object({ account_id: id, zone_name: hostname }).strict(),
    hosts: z
      .object({
        apex: hostname,
        admin: hostname,
        web: hostname,
        api: hostname,
        broker: hostname,
      })
      .strict(),
    /**
     * Where new checkouts go when several providers' keys are present
     * (rendered into the API Worker as `BILLING_PROVIDER`).
     */
    billing: z.object({ provider: z.enum(['stripe', 'paddle']) }).strict(),
    population: z
      .object({
        replicas: z.number().int().min(1).max(100).default(1),
        capacity: z.number().int().min(1).max(32).default(1),
        vcpus: z.number().min(0.5).max(8).default(1),
        memory_gb: z.number().min(0.5).max(32).default(2),
        region: slug.default('us-west2'),
      })
      .strict()
      .default({
        replicas: 1,
        capacity: 1,
        vcpus: 1,
        memory_gb: 2,
        region: 'us-west2',
      }),
    /**
     * How often Grafana Synthetic Monitoring checks the environment from
     * outside (stacks/bootstrap/alerting.tf). Every environment shares the
     * stack's monthly allowance, so only production checks every minute;
     * an environment that says nothing is checked every hour.
     */
    synthetic_monitoring: z
      .object({ every_seconds: z.number().int().min(60).max(3600) })
      .strict()
      .default({ every_seconds: 3600 }),
    secrets: z
      .object({ regenerate: z.array(z.string()).optional() })
      .strict()
      .optional(),
    imports: z
      .object({
        foundation: z
          .object({ secrets: z.array(z.string()).optional() })
          .catchall(id)
          .optional(),
        edge: z
          .object({ custom_domains: z.record(z.string(), id).optional() })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type EnvFile = z.infer<typeof envFileSchema>;

/** How carefully an environment is treated: `production` or `standard`. */
export type EnvProtection = EnvFile['protection'];

/**
 * Whether an environment is production. Derived from its `protection`, never
 * its name, so a new env file decides this for itself.
 */
export function isProductionEnv(env: EnvFile): boolean {
  return env.protection === 'production';
}

/** Names of the production environments among `envs`. */
export function productionEnvNames(
  envs: readonly EnvFile[]
): readonly string[] {
  return envs.filter(isProductionEnv).map((env) => env.env);
}

/** Resolves an env file's placeholders (`resolveEnvVars`), then validates it. */
export function parseEnvFile(raw: unknown, source: string): EnvFile {
  const result = envFileSchema.safeParse(resolveEnvVars(raw));
  if (result.success) return result.data;
  throw new Error(`${source}: ${z.prettifyError(result.error)}`);
}

/** Every hostname an environment serves. */
export function envHostnames(env: EnvFile): readonly string[] {
  return Object.values(env.hosts);
}

/**
 * Identifiers of things that hold data or route users. Two environments
 * sharing one of these would let a plan for one mutate the other, so they
 * must be pairwise distinct across every env file.
 */
export function statefulIdentities(
  env: EnvFile
): Readonly<Record<string, string>> {
  const identities: Record<string, string> = {
    env: env.env,
    suffix: env.suffix,
    'worker:product': env.worker.name,
    'worker:admin': env.worker.admin_name,
  };
  for (const [name, host] of Object.entries(env.hosts))
    identities[`host:${name}`] = host;
  return identities;
}

/**
 * Returns one message per identity two env files share; empty when the
 * environments are fully isolated from each other.
 */
export function sharedIdentities(envs: readonly EnvFile[]): readonly string[] {
  const owner = new Map<string, string>();
  const clashes: string[] = [];
  for (const env of envs) {
    for (const [key, value] of Object.entries(statefulIdentities(env))) {
      const kind = key.split(':')[0];
      const claim = `${kind}=${value}`;
      const previous = owner.get(claim);
      if (previous !== undefined) {
        clashes.push(`${claim} is claimed by both ${previous} and ${env.env}`);
      }
      owner.set(claim, env.env);
    }
  }
  return clashes;
}

export type EnvOrigins = {
  readonly apex: string;
  readonly admin: string;
  readonly web: string;
  readonly api: string;
  readonly broker: string;
};

/** `https://` origins of everything an environment serves. */
export function envOrigins(env: EnvFile): EnvOrigins {
  return {
    apex: `https://${env.hosts.apex}`,
    admin: `https://${env.hosts.admin}`,
    web: `https://${env.hosts.web}`,
    api: `https://${env.hosts.api}`,
    broker: `https://${env.hosts.broker}`,
  };
}

/** Origin of the one OAuth callback relay (`global.tfvars.json` `auth_relay`). */
export function authRelayOrigin(): string {
  return `https://${GLOBAL.auth_relay.hostname}`;
}

export function adminStateTag(env: EnvFile): string {
  return `admin-${env.env}`;
}

/**
 * The relay returns callbacks to the product or admin API that minted their state.
 * Every env file contributes both targets, so a
 * new environment is reachable as soon as the relay redeploys (the Release
 * workflow's fleet job, before any environment deploys).
 */
export function authRelayTargets(
  envs: readonly EnvFile[]
): Readonly<Record<string, string>> {
  const targets: Record<string, string> = {};
  for (const env of envs) {
    const origins = envOrigins(env);
    for (const [tag, origin] of [
      [env.env, origins.api],
      [adminStateTag(env), origins.admin],
    ] as const) {
      if (Object.hasOwn(targets, tag))
        throw new Error(`OAuth callback tag ${tag} has two owners`);
      targets[tag] = origin;
    }
  }
  return targets;
}

/**
 * Plain-text vars the API Worker boots with, derived from the env file so a
 * new replica needs no hand-set configuration. Names match the bindings
 * `@libs/server-app` and `@pkgs/auth-inhouse` read
 * (`apps/product-api-ts/tests/wrangler-config.test.ts` pins them).
 */
export function apiWorkerVars(env: EnvFile): Readonly<Record<string, string>> {
  return {
    API_URL: envOrigins(env).api,
    EMQX_WSS_URL: `wss://${env.hosts.broker}/mqtt`,
    WEB_CLIENT_ORIGIN: envOrigins(env).web,
    WEB_CLIENT_APEX_ORIGIN: envOrigins(env).apex,
    OAUTH_CALLBACK_ORIGIN: authRelayOrigin(),
    OAUTH_STATE_TAG: env.env,
    BILLING_PROVIDER: env.billing.provider,
    FEEDBACK_GITHUB_REPOSITORY: GITHUB_REPOSITORY,
  };
}
