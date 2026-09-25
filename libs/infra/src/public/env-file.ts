/**
 * The environment file (`tofu/envs/<env>.tfvars.json`): the only place an
 * environment's identity lives. Both stacks read it as a `-var-file`; this
 * schema mirrors their `variables.tf` so `bun check` can validate every env
 * file — and the invariants OpenTofu cannot express across files — without
 * credentials.
 */
import { z } from 'zod';

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
    protection: z.enum(['production', 'standard']),
    cloudflare: z.object({ account_id: id, zone_name: hostname }).strict(),
    hosts: z
      .object({
        apex: hostname,
        web: hostname,
        api: hostname,
        broker: hostname,
      })
      .strict(),
    railway: z.object({ workspace_id: id, project_name: id }).strict(),
    neon: z.object({ branch_id: id }).strict(),
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

export function parseEnvFile(raw: unknown, source: string): EnvFile {
  const result = envFileSchema.safeParse(raw);
  if (result.success) return result.data;
  throw new Error(`${source}: ${z.prettifyError(result.error)}`);
}

/** Every hostname an environment serves. */
export function envHostnames(env: EnvFile): readonly string[] {
  return [env.hosts.apex, env.hosts.web, env.hosts.api, env.hosts.broker];
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
    'railway.project_name': `${env.railway.workspace_id}/${env.railway.project_name}`,
    'neon.branch_id': env.neon.branch_id,
  };
  for (const host of envHostnames(env)) identities[`host:${host}`] = host;
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
      const kind = key.startsWith('host:') ? 'host' : key;
      const claim = `${kind}=${value}`;
      const previous = owner.get(claim);
      if (previous !== undefined && previous !== env.env) {
        clashes.push(`${claim} is claimed by both ${previous} and ${env.env}`);
      }
      owner.set(claim, env.env);
    }
  }
  return clashes;
}

export type EnvOrigins = {
  readonly apex: string;
  readonly web: string;
  readonly api: string;
  readonly broker: string;
};

/** `https://` origins of everything an environment serves. */
export function envOrigins(env: EnvFile): EnvOrigins {
  return {
    apex: `https://${env.hosts.apex}`,
    web: `https://${env.hosts.web}`,
    api: `https://${env.hosts.api}`,
    broker: `https://${env.hosts.broker}`,
  };
}
