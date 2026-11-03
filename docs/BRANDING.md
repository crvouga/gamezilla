# Branding and identity

Deployment identity belongs in an external configuration store, not Git.
A rebrand changes external configuration and rebuilds/redeploys the same source commit. No source, native
project, image, manifest or alert-rule edit is required.

## Source of truth

`PRODUCT_IDENTITY_JSON` is public deployment configuration, not an application
credential. Store it as a GitHub repository variable; an explicitly injected
value (including an optional shared Infisical key) takes precedence. Its
shape is [the language-neutral schema](../libs/product-identity/product-identity.schema.json).
Validation runs before generation; absent, malformed or stale configured input
stops a deployment instead of silently shipping the verification fixture.

| Section | Meaning | Rebrand treatment |
| --- | --- | --- |
| `brand` | Display name, short name, public domain, colors, security contact and trusted SVG artwork | Edit these values in the external store |
| `technical.namespace` | Stable resource, telemetry and persisted-client-key namespace | Preserve for an existing deployment |
| `external` | Registered deep links, bundle ID, repository, vendor accounts and GitHub environments | Preserve unless performing a separate compatibility migration |
| `aliases` | Previous brand spellings used by the brand-isolation gate | Add previous spellings to external configuration |

The build-local `libs/product-identity/product-identity.json` is generated and
ignored. Other languages can read it; TypeScript uses
`@libs/product-identity-shared-ts/product-identity`. It is never an editable,
committed source of deployment values.

## Rebrand without a source change

1. Update the repository variable with
   `gh variable set PRODUCT_IDENTITY_JSON < /path/to/local-identity.json`.
   For an Infisical override, the existing
   `bun run secrets:seed --env dev PRODUCT_IDENTITY_JSON` command accepts a
   document over stdin and routes this optional shared key to `shared`;
   `--force` explicitly replaces an existing override. Do not put the document
   into Git, a command argument or a log.
2. Run the normal release workflow against the same source commit. Its secrets
   wrapper loads the selected identity from injected configuration or the
   repository variable, validates/materializes it, then regenerates web/native
   artwork, platform metadata, operational rules and organization-scoped agent configuration before the command imports
   product modules.
3. For a local configured build, run
   `bun run libs/secrets-server-ts/scripts/secrets-run.ts -- bun run identity:configure`,
   then the desired build through that same secrets wrapper. Production secret
   fetching follows the existing live-only policy; verification needs no login.
4. Review the infrastructure plan. A brand-only change may change hostnames,
   DNS records and custom domains; it must preserve stateful resources.

Web changes take effect on rebuild/deploy. Installed native app names/icons
require a new signed app release. Domain registration, DNS cutover, OAuth
redirect registrations and vendor approvals remain external configuration or
infrastructure operations; changing text does not provision them.

## Generated outputs

`bun install` / `bun run generate` prepare an offline development checkout.
Without configured input, a cold checkout uses the explicitly neutral
[verification fixture](../libs/product-identity/fixtures/verification-identity.json).
It is test data, never the source of deployed branding. Run configured local
builds through the secrets wrapper so the selected external input is supplied
on every rebuild.

The brand generator writes install icons, favicons, launch images, web
manifest, security contact and native Swift/xcconfig. A separate uncached task
prepares organization-scoped agent settings. The SLO generator writes the derived observability JSON.
All identity-bearing outputs are ignored and untracked. Organization-scoped
agent settings are generated in a separate uncached task because they preserve
local user entries; those entries never enter a build cache. Image dimensions and
variants live in `libs/tools-harness-ts/brand/web-image-artifacts/`; the SVG and
colors come only from configuration. Sharp stays in tooling, outside client
runtime dependencies. Product-independent design-system examples and visual
references use neutral fixture artwork.

`secrets-run` prepares configuration through Turbo before starting its command.
Configured builds also check source isolation against the selected real identity;
fixture verification cannot hide a hardcoded deployment brand.
`bun run identity:configure` is the same task graph for an already injected
environment. Infrastructure applies and Worker uploads also reject a loaded
identity that differs from `PRODUCT_IDENTITY_JSON`. GitHub Actions passes public configuration through declared setup inputs,
exports it after secret injection and materializes it for deployment/Health; local configured commands can
read it through the authenticated GitHub CLI. An invalid injected override
fails instead of being silently replaced by a different source.

## Verification

Local full verification explicitly selects `PRODUCT_IDENTITY_MODE=fixture`
and lets its private snapshot generate outputs, preserving the configured
caller checkout;
hosted verification uses the secrets wrapper's `--fixture` option, independent
of deployment settings. Hosted read-only infrastructure plans use configured
mode instead.
Release and Health use configured mode by default.

- `verify:brand-policy` refuses configured brand spellings outside the identity
  schema/fixture package and proven generated artifacts.
- Input properties prove external values survive parsing; regression examples
  reject absent, malformed and stale configuration.
- Artifact tests prove every generated file follows configuration and every
  image has the expected pixels. A repository test refuses tracked or
  non-ignored deployment identity and brand artifacts.
- `verify:rebrand` supplies a synthetic identity through the external input,
  regenerates from a cold copy, runs affected suites and builds the web app.
  It then requires no tracked-file diff. A future brand may not require a PR.

## Adopting an existing deployment

Move the current identity into the external store without changing its technical
namespace or registered identifiers. Preserve existing encrypted state,
resources, client storage keys and registrations. The neutral verification
fixture does not rename production resources.

If a technical namespace or external identifier must change, plan and verify
that migration separately. In particular, the state bucket resolves from
`{namespace}-tofu-state`: credentials must read the existing encrypted state
and backups before any plan or apply. A new inaccessible backend can fail S3
`HeadObject` with 403. Never replace it with empty state or bypass the plan
gate. Infrastructure bootstrap and state protections are documented in
[README.md](../README.md#infrastructure).
