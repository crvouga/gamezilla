/**
 * `tofu/global.tfvars.json`: what is the same for every environment — the
 * project slug, where state lives, the secrets project, the repository and
 * the one OAuth callback relay every environment signs in through, the
 * PlanetScale organization every environment's database lives in, and the
 * AWS region of the invalidation broker.
 * Every stack reads it, resolved (`tofu-vars.ts`), as its first `-var-file`.
 */
import { z } from 'zod';
import raw from '../tofu/global.tfvars.json';
import { resolveGlobalVars } from './tofu-vars';

const id = z.string().min(1);
const slug = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);
const hostname = z
  .string()
  .regex(/^(?=.{1,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/, 'must be a lowercase FQDN');

export const globalFileSchema = z
  .object({
    project: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    /** The name people see (`{brand}`): alert routing, the app-shell check. */
    brand_name: z.string().min(1),
    state: z.object({ account_id: id, bucket: id }).strict(),
    shared_data: z.object({ account_id: id, bucket: slug }).strict(),
    /**
     * The one bucket CI jobs hand files through (fleet stack): a job's plan,
     * verdicts and evidence, and the nightly profile's reports. Every object
     * expires after `retention_days`.
     */
    ci_artifacts: z
      .object({
        account_id: id,
        bucket: slug,
        retention_days: z.number().int().min(1).max(30),
      })
      .strict(),
    infisical: z
      .object({
        org_id: id,
        project_id: id,
        project_slug: id,
        shared_env: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
      })
      .strict(),
    /**
     * PlanetScale organization slug and the Postgres region. `organization` is
     * the slug PlanetScale shows for the account, from the identity's
     * `external.planetscaleOrganization`. A wrong slug fails the foundation
     * apply with the organization's name.
     */
    planetscale: z
      .object({
        organization: slug,
        region: id,
      })
      .strict(),
    /** One AWS region for IoT Core. Growth stays in this region. */
    aws: z.object({ region: id }).strict(),
    railway: z.object({ workspace_id: z.uuid() }).strict(),
    grafana: z
      .object({
        stack_slug: z.string().regex(/^[a-z][a-z0-9]*$/),
        region: id,
      })
      .strict(),
    /**
     * Stack-wide alerting (stacks/bootstrap/alerting.tf): the public probe
     * Synthetic Monitoring checks from, and the IRM routing, which stays off
     * while the responder or the digest address is null.
     */
    alerting: z
      .object({
        probe: id,
        irm_responder: id.nullable(),
        digest_email: z.email().nullable(),
      })
      .strict(),
    github: z
      .object({
        owner: id,
        owner_id: z.string().regex(/^[1-9][0-9]*$/),
        owner_is_organization: z.boolean(),
        repo: id,
        repo_id: z.string().regex(/^[1-9][0-9]*$/),
        settings: z
          .object({
            visibility: z.enum(['private', 'public', 'internal']),
            homepage_url: z.url(),
            has_issues: z.boolean(),
            has_projects: z.boolean(),
            has_wiki: z.boolean(),
            has_discussions: z.boolean(),
            allow_forking: z.boolean(),
          })
          .strict(),
        environments: z.array(id),
      })
      .strict(),
    /**
     * The Worker at `hostname` owning the one OAuth callback registered with
     * Google: every environment sends it as `redirect_uri` and it forwards
     * each callback to the environment that started the sign-in
     * (`apps/auth-relay-ts`, `@pkgs/auth-inhouse` `oauth-callback-relay.ts`).
     */
    auth_relay: z
      .object({
        account_id: id,
        zone_name: hostname,
        hostname,
        worker: slug,
      })
      .strict(),
    global_imports: z
      .object({
        infisical_environments: z.record(z.string(), id).optional(),
        shared_data: z.boolean().optional(),
        github_repository: id.optional(),
        github_variables: z.array(id).optional(),
        grafana_stack: id.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type GlobalFile = z.infer<typeof globalFileSchema>;

/** `tofu/global.tfvars.json` as committed: placeholders unresolved. */
export const GLOBAL_SOURCE: unknown = raw;

/** Resolves and validates a global var file (`resolveGlobalVars`). */
function parseGlobalFile(source: unknown): GlobalFile {
  const result = globalFileSchema.safeParse(resolveGlobalVars(source));
  if (result.success) return result.data;
  throw new Error(`tofu/global.tfvars.json: ${z.prettifyError(result.error)}`);
}

export const GLOBAL: GlobalFile = parseGlobalFile(GLOBAL_SOURCE);
