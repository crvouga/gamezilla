/**
 * Brand isolation: the product's brand, its technical namespace, its frozen
 * external identifiers and every historical alias are spelled in exactly one
 * place, `@libs/product-identity`. Everything else reads them through
 * `@libs/product-identity-shared-ts` (or, where code cannot import, through
 * `{namespace}` / `{domain}` / `{brand}` placeholders that tooling resolves).
 *
 * A file may also carry those spellings when it is a registered generated
 * artifact (`libs/product-identity/generated-artifacts.json`) whose freshness
 * test regenerates it and fails on any difference: its content then comes
 * from the identity, never from a hand edit.
 */
import type { ProductIdentity } from '@libs/product-identity-shared-ts/product-identity';

/** The one directory that may spell the brand. */
export const IDENTITY_DIR = 'libs/product-identity/';

export type GeneratedArtifact = {
  readonly path: string;
  /** The command that writes it (`bun run <script>`). */
  readonly generator: string;
  /** A test that regenerates the artifact and fails on any difference. */
  readonly freshnessTest: string;
};

export type ScannedFile = {
  readonly path: string;
  /** Null for a binary file (only its path is checked). */
  readonly text: string | null;
};

export type BrandViolation = {
  readonly path: string;
  /** 0 when the path itself spells the brand. */
  readonly line: number;
  readonly token: string;
};

/**
 * Every spelling the policy refuses, lower-cased: the brand's names and
 * domain, the technical namespace, every external identifier and every
 * alias. Longest first so a report names the most specific match.
 */
export function brandTokens(identity: ProductIdentity): string[] {
  const values = [
    identity.brand.name,
    identity.brand.shortName,
    identity.brand.domain,
    identity.technical.namespace,
    identity.external.deepLinkScheme,
    identity.external.appleBundleId,
    identity.external.planetscaleOrganization,
    identity.external.sentryOrganization,
    ...identity.external.githubEnvironments,
    ...identity.aliases,
    // The repository's own name, not its owner (an owner is a person).
    ...[
      identity.external.sourceRepository,
      ...identity.external.previousSourceRepositories,
    ].map((repository) => repository.split('/')[1] ?? repository),
  ];
  return [...new Set(values.map((value) => value.toLowerCase()))]
    .filter((value) => value.length >= 3)
    .sort((a, b) => b.length - a.length || a.localeCompare(b));
}

/** First token found in `text` (case-insensitive), or undefined. */
function firstToken(
  text: string,
  tokens: readonly string[]
): string | undefined {
  const lower = text.toLowerCase();
  return tokens.find((token) => lower.includes(token));
}

export function brandViolations(
  files: readonly ScannedFile[],
  tokens: readonly string[],
  exempt: ReadonlySet<string>
): BrandViolation[] {
  const out: BrandViolation[] = [];
  for (const file of files) {
    if (file.path.startsWith(IDENTITY_DIR)) continue;
    const inPath = firstToken(file.path, tokens);
    if (inPath !== undefined)
      out.push({ path: file.path, line: 0, token: inPath });
    if (file.text === null || exempt.has(file.path)) continue;
    const lines = file.text.split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      const token = firstToken(lines[index] ?? '', tokens);
      if (token !== undefined)
        out.push({ path: file.path, line: index + 1, token });
    }
  }
  return out;
}

/**
 * Generated artifacts whose provenance holds: the freshness test exists and
 * names the artifact, and the generator's script exists. Any other entry is
 * a problem, and its file gets no exemption.
 */
export function verifiedArtifacts(
  artifacts: readonly GeneratedArtifact[],
  read: (path: string) => string | null
): { readonly exempt: Set<string>; readonly problems: string[] } {
  const exempt = new Set<string>();
  const problems: string[] = [];
  for (const artifact of artifacts) {
    const test = read(artifact.freshnessTest);
    const script = /\S+\.(?:ts|mts|js)\b/.exec(artifact.generator)?.[0];
    if (test === null)
      problems.push(
        `${artifact.path}: freshness test ${artifact.freshnessTest} does not exist`
      );
    else if (
      !test.includes(artifact.path.split('/').pop() ?? artifact.path) &&
      !test.includes('BRAND_ARTIFACTS')
    )
      problems.push(
        `${artifact.path}: ${artifact.freshnessTest} never reads it`
      );
    else if (script === undefined || read(script) === null)
      problems.push(
        `${artifact.path}: generator "${artifact.generator}" names no script that exists`
      );
    else exempt.add(artifact.path);
  }
  return { exempt, problems };
}

export function renderViolation(violation: BrandViolation): string {
  const where =
    violation.line === 0
      ? `${violation.path} (its path)`
      : `${violation.path}:${String(violation.line)}`;
  return `${where}: spells "${violation.token}"`;
}
