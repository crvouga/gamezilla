import fixture from '@libs/product-identity/fixtures/verification-identity.json' with {
  type: 'json',
};
import {
  type ProductIdentity,
  parseProductIdentity,
} from './identity-schema.ts';

/** Verification is explicit and offline; configured builds never fall back. */
export function identityInput(
  mode: 'fixture' | 'configured',
  value: string | undefined
): ProductIdentity {
  if (mode === 'fixture') return parseProductIdentity(fixture);
  if (value === undefined || value.trim() === '')
    throw new Error(
      'PRODUCT_IDENTITY_JSON is required from external configuration; set it in Infisical or the repository variable before identity:configure'
    );
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('PRODUCT_IDENTITY_JSON must contain a valid JSON document');
  }
  return parseProductIdentity(parsed);
}

/** Deploying stale or fixture artifacts must stop before any external write. */
export function requireConfiguredIdentity(
  value: string | undefined,
  loaded: ProductIdentity
): void {
  const desired = identityInput('configured', value);
  if (JSON.stringify(desired) !== JSON.stringify(loaded))
    throw new Error(
      'Build identity differs from external configuration; run identity:configure before deployment'
    );
}

/** Explicit environment injection wins; an invalid override must never be hidden. */
export function configuredIdentity(
  injected: string | undefined,
  repository: () => string | undefined
): ProductIdentity {
  const value =
    injected === undefined || injected.trim() === '' ? repository() : injected;
  return identityInput('configured', value);
}
