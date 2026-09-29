/**
 * `tofu/global.tfvars.json`: what is the same for every environment — the
 * project slug, where state lives, the secrets project, the repository and
 * the one OAuth callback relay every environment signs in through, the
 * bucket that serves every commit's spec report, and the
 * one Railway project every environment's broker runs in.
 * Every stack reads it as its first `-var-file`.
 */
import { z } from 'zod';
import raw from '../../tofu/global.tfvars.json';

const id = z.string().min(1);
const slug = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);
const hostname = z
  .string()
  .regex(/^(?=.{1,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/, 'must be a lowercase FQDN');

export const globalFileSchema = z
  .object({
    project: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    state: z.object({ account_id: id, bucket: id }).strict(),
    infisical: z
      .object({
        org_id: id,
        project_id: id,
        project_slug: id,
        shared_env: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
      })
      .strict(),
    neon_project: z.object({ project_id: id, root_branch_id: id }).strict(),
    grafana: z
      .object({
        stack_slug: z.string().regex(/^[a-z][a-z0-9]*$/),
        region: id,
      })
      .strict(),
    github: z
      .object({ owner: id, repo: id, required_checks: z.array(id).min(1) })
      .strict(),
    /**
     * The Worker at `hostname` owning the one OAuth callback registered with
     * Google: every environment sends it as `redirect_uri` and it forwards
     * each callback to the environment that started the sign-in
     * (`apps/auth-relay`, `@pkgs/auth-inhouse` `oauth-callback-relay.ts`).
     */
    auth_relay: z
      .object({
        account_id: id,
        zone_name: hostname,
        hostname,
        worker: slug,
      })
      .strict(),
    /**
     * The one private bucket holding every commit's spec reports (fleet
     * stack; `bun run check:report`): CI writes with, and each environment's
     * API reads with, that environment's own credential (foundation stack).
     * Each report expires after `retention_days`.
     */
    reports: z
      .object({
        account_id: id,
        bucket: z.string().regex(/^[a-z0-9][a-z0-9-]{2,62}$/),
        retention_days: z.number().int().positive(),
      })
      .strict(),
    /**
     * The one Railway project every environment's MQTT broker runs in and
     * its shared `emqx` service (fleet stack). Each environment is a Railway
     * environment of it named after the env file's `suffix`.
     */
    railway: z
      .object({ workspace_id: id, project_id: id, service_id: id })
      .strict(),
    global_imports: z
      .object({
        infisical_environments: z.record(z.string(), id).optional(),
        github_repository: id.optional(),
        github_branch_protection: id.optional(),
        github_variables: z.array(id).optional(),
        grafana_stack: id.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type GlobalFile = z.infer<typeof globalFileSchema>;

export const GLOBAL: GlobalFile = (() => {
  const result = globalFileSchema.safeParse(raw);
  if (result.success) return result.data;
  throw new Error(`tofu/global.tfvars.json: ${z.prettifyError(result.error)}`);
})();
