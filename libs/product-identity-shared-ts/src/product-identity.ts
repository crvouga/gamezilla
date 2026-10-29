/**
 * The product's identity, read from the neutral `@libs/product-identity`
 * (`product-identity.json`, schema beside it). Nothing else in the repository
 * may spell the brand, the technical namespace or a frozen external
 * identifier: everything reads them from here (`verify:brand-policy`).
 *
 * - `brand` is what people see. A rebrand changes it, and every surface and
 *   generated artifact follows.
 * - `technical.namespace` never changes. Resource, telemetry, storage and
 *   runtime identifiers derive from it, so a rebrand replaces nothing.
 * - `external` holds identifiers registered elsewhere (deep links, bundle
 *   ids, the source repository, vendor accounts). They survive a rebrand
 *   until an authorized migration changes them.
 */
import raw from '@libs/product-identity/product-identity.json' with {
  type: 'json',
};
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
    throw new Error(`product-identity.json: ${z.prettifyError(result.error)}`);
  return result.data;
}

/** This repository's product identity. */
export const PRODUCT: ProductIdentity = parseProductIdentity(raw);

/** The display name people see. */
export const PRODUCT_NAME = PRODUCT.brand.name;

/** The immutable technical namespace (`technical.namespace`). */
export const NAMESPACE = PRODUCT.technical.namespace;
