/** Validated external identity configuration; safe to load before generation. */
import { z } from 'zod';

const domain = z
  .string()
  .regex(/^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/);
const color = z.string().regex(/^#[0-9a-f]{6}$/);
const repository = z.string().regex(/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/);

export const productIdentitySchema = z
  .object({
    $schema: z.string().optional(),
    brand: z
      .object({
        name: z.string().min(2).max(40),
        shortName: z.string().min(2).max(12),
        domain,
        themeColor: color,
        backgroundColor: color,
        securityContact: z.string().regex(/^(mailto:|https:\/\/)/),
        markSvg: z.string().regex(/^<svg[\s>][\s\S]*<\/svg>$/),
      })
      .strict(),
    technical: z
      .object({ namespace: z.string().regex(/^[a-z][a-z0-9]{1,19}$/) })
      .strict(),
    external: z
      .object({
        deepLinkScheme: z.string().regex(/^[a-z][a-z0-9+.-]*$/),
        appleBundleId: z.string().regex(/^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/),
        sourceRepository: repository,
        previousSourceRepositories: z.array(repository),
        planetscaleOrganization: z.string().regex(/^[a-z0-9-]+$/),
        sentryOrganization: z.string().regex(/^[a-z0-9-]+$/),
        githubEnvironments: z.array(z.string().min(1)),
      })
      .strict(),
    aliases: z.array(z.string().min(3)).min(1),
  })
  .strict();

export type ProductIdentity = z.infer<typeof productIdentitySchema>;

/** Parses an identity document, naming the field that breaks the schema. */
export function parseProductIdentity(value: unknown): ProductIdentity {
  const result = productIdentitySchema.safeParse(value);
  if (!result.success)
    throw new Error(`PRODUCT_IDENTITY_JSON: ${z.prettifyError(result.error)}`);
  return result.data;
}
