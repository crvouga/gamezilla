/**
 * `tofu/global.tfvars.json`: what is the same for every environment — the
 * project slug, where state lives, the secrets project and the repository.
 * Every stack reads it as its first `-var-file`.
 */
import { z } from 'zod';
import raw from '../../tofu/global.tfvars.json';

const id = z.string().min(1);

export const globalFileSchema = z
  .object({
    project: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    state: z.object({ account_id: id, bucket: id }).strict(),
    infisical: z
      .object({ org_id: id, project_id: id, project_slug: id })
      .strict(),
    neon_project: z.object({ project_id: id }).strict(),
    github: z
      .object({ owner: id, repo: id, required_checks: z.array(id).min(1) })
      .strict(),
    global_imports: z
      .object({
        infisical_environments: z.record(z.string(), id).optional(),
        github_repository: id.optional(),
        github_branch_protection: id.optional(),
        github_variables: z.array(id).optional(),
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
