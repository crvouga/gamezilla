# Branding and identity

The product's brand is configuration, not code. One file says what the
product is called and where it lives; everything else reads it, so a rebrand
is an edit to that file plus regenerating artifacts, and it replaces no
infrastructure.

## The one source

[`libs/product-identity/product-identity.json`](../libs/product-identity/product-identity.json)
(schema beside it, language-neutral):

| Section | What | Changes on a rebrand? |
| --- | --- | --- |
| `brand` | Display name, short name, domain, colors, security contact | Yes: every surface and generated artifact follows |
| `technical.namespace` | Immutable technical namespace | **Never.** Resource, telemetry, storage and runtime identifiers derive from it |
| `external` | Identifiers registered elsewhere: deep-link scheme, Apple bundle id, source repository, vendor accounts, GitHub environments | Only through an explicit, authorized migration |
| `aliases` | Every spelling the brand has had | Grows; the brand policy refuses each one |

The namespace is not the brand. It happens to equal the brand's first slug
because the infrastructure was created under that name; it stays that value
forever so no deployed resource, stored session, dashboard or alert is
renamed when the brand changes.

## Reading it

- **TypeScript:** `@libs/product-identity-shared-ts`
  - `product-identity`: `PRODUCT`, `PRODUCT_NAME`, `NAMESPACE`
  - `brand-hosts`: `brandHost(label)`, `brandOrigin(label)`, `webOrigin()`, `apiHost()`
  - `technical-names`: `technicalName(parts)` (`<ns>-api-production`),
    `technicalKey(key, sep)` (`<ns>.auth.bearer`), `serviceName(component)`
  - `identity-placeholders`: resolve `{namespace}`, `{domain}`, `{brand}`
  - `brand-html`: `%BRAND_NAME%` / `%BRAND_THEME_COLOR%` in `index.html`
    (`brandHtmlPlugin()` for Vite)
  - `synthetic-identity`: a synthetic brand for rebrand tests
- **Configuration that cannot import code** (OpenTofu variable files,
  `wrangler.toml`, HTML): `{namespace}`, `{domain}`, `{brand}` placeholders,
  resolved by the tooling that reads the file (the OpenTofu wrapper writes
  resolved variable files; tofu itself sees the same values as before).
- **Other languages** read `product-identity.json` directly, or a generated
  artifact (Swift reads `product-identity.generated.swift`).
- **`pkgs/`** stay product-agnostic: they never import the identity and use
  neutral examples (`example.com`, `acme`) in code and tests.
- **Copy:** the brand in user-facing text is a placeholder
  (``t`${productName} can’t be reached` ``), never a literal.
- **Tests** compute expected values from the accessor or use the synthetic
  identity; a brand string in a test is a violation like any other.

## Generated artifacts

Files a platform needs as static data (web manifest, `security.txt`, the
Swift identity) are rendered from the identity by
`@libs/product-identity-shared-ts` (`BRAND_ARTIFACTS`) and written by
`bun run libs/product-identity-shared-ts/scripts/generate-brand-artifacts.ts`.
`tests/brand-artifacts.test.ts` fails while a committed artifact differs from
what the generator writes, and checks that every artifact follows a synthetic
rebrand. Other generators that embed identity-derived values (the Grafana
alert rules) are listed in `libs/product-identity/generated-artifacts.json`
with their own freshness test.

## Enforcement

`@libs/tools-harness-ts#verify:brand-policy` runs on every pull request. It
reads every tracked or new file (content and path) and fails on any spelling
of the brand's names, domain, namespace, external identifiers or aliases,
case-insensitively, outside `libs/product-identity/` and the verified
generated artifacts. There is no other exemption: a generated file is exempt
only while its freshness test proves it came from the identity.

## The rebrand test

`@libs/tools-harness-ts#verify:rebrand` runs a rebrand end to end on every
pull request, in an isolated copy of the repository:

1. Copy every file; link dependencies so workspace imports resolve inside the
   copy.
2. Give the copy a brand nobody spelled (derived from a hash of the current
   one), with the same namespace and external identifiers.
3. Regenerate everything: `bun run generate`, the brand artifacts, the SLO
   artifacts.
4. Require that the old brand's name and domain appear nowhere outside the
   identity (external identifiers aside), that the brand policy passes for
   the new brand, that the brand-sensitive suites pass (including the
   OpenTofu inputs keeping every resource name, so a rebrand replaces no
   infrastructure), and that the web client builds.

## Infrastructure names

Resource names are deterministic: a pure function of the namespace (and the
environment), never of the brand and never random.
`@pkgs/resource-naming-shared-ts` holds each provider's rules (length,
characters, case, global uniqueness) and the naming algorithm (deterministic
truncation with a stable hash, a stable scope suffix for globally unique
kinds). Hostnames are the only infrastructure values that follow the brand
(they sit under `brand.domain`); a domain change adds new DNS records and
custom domains and leaves every stateful resource in place.

## Rebranding

1. Edit `brand` in `product-identity.json`; add the old spellings to
   `aliases`.
2. Run the brand artifact generator and the SLO generator; commit.
3. `verify:rebrand` and `verify:brand-policy` must pass; review the
   infrastructure plan: only hostnames, DNS records and custom domains may
   change.
4. External identifiers (`external`) stay as they are. Changing one (a new
   bundle id, deep-link scheme or repository) is a separate migration with
   its own compatibility plan and explicit authorization.
