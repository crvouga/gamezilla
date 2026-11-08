# Source protection runbook

## What is enforced, and what is not

[LICENSE](../LICENSE) reserves first-party rights, including automated reuse,
training and derived ports. Third-party rights and applicable law still apply.
Have counsel review the notice, ownership, contributor history and any earlier
licenses before relying on it for enforcement. New terms cannot revoke rights
already granted for earlier copies. This is source available, not open source.

Public GitHub repositories have no unlisted mode. Visitors can view and fork
them under [GitHub's terms](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository).
Notices cannot prevent downloads, agents ignoring instructions, independent
implementation, or removal of fingerprints. No anti-agent exploit, tracking
callback, secret watermark or obfuscation is used.

## Build evidence

Both web Vite configurations enable `artifactProtection` from
`@pkgs/vite-workspace-resolver-server-ts/artifact-protection`. Builds add:

- A stable opaque origin identifier and a content digest to emitted JavaScript.
- An origin meta tag and `noindex, nofollow, nosnippet` to built HTML.
- `artifact-provenance.json`, with SHA-256 hashes of the Vite output bundle.
- Disabled source maps.

The manifest excludes itself, copied public files and subsequent processing,
including Workbox's service worker. Its file digests describe the bytes at the
plugin's bundle hook. The JavaScript banner's content digest hashes the chunk
before the banner is prepended; use the manifest for exact emitted-byte
comparisons. The origin is deliberately public, removable
and forgeable. It is evidence to investigate, not proof of infringement.

Before each production release, retain the final deployed artifact, manifest,
commit SHA, workflow run URL, dependency lockfile and license text in a controlled
archive outside this repository. Hash the **final** archive, including service
workers and public assets, and sign/attest that digest with a separately protected
release identity. Keep signature verification material and retention backups.
Signing and archival are operational steps, not implemented by this plugin.
Never put a private signing key in source, a client bundle or a public CI log.
Do not treat short-lived verification artifacts as this archive.

When a suspected copy appears, preserve the original downloaded bytes, URL and
collection time. Compare their SHA-256 digests with the retained manifest, then
search JavaScript for the origin marker. Preserve changed files too: absent or
different fingerprints do not establish independent authorship. Have counsel
evaluate source similarity and the evidence before issuing a takedown.

## Discovery and indexing

The production identity is already external `PRODUCT_IDENTITY_JSON`; follow
[BRANDING.md](BRANDING.md). Keep real identity inputs and generated outputs out
of git. Technical namespaces, bundle IDs and auth identifiers can carry persisted
state; do not rotate them merely to rename the repository.

The HTML directives affect built websites, **not github.com**. GitHub controls
the headers, robots policy and search index for repository pages. A repository
root robots.txt would not control those pages. Do not block crawling of a page
whose noindex directive you need a search engine to read; see
[Google's noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing).
Noncompliant crawlers can ignore every directive. This change also suppresses
indexing of the built product HTML; reconsider that setting before a public
marketing launch.

Review repository description, topics, homepage, profile pins, public Pages,
Storybook deployments, package registries, social links and release assets for
product associations. Remove unnecessary public links and deployments through
their owning configuration. Existing search results, historical commits, forks,
issue text, screenshots and third-party caches can retain associations.

## Rename the repository

1. Choose a neutral name unrelated to the product, such as `source-core`.
2. Inventory consumers: Actions/OIDC trust, OpenTofu repository configuration,
   app installations, deploy keys, webhooks, badges, registry links and remotes.
3. Prepare the repository-policy/IaC changes and external identity configuration:
   update `external.sourceRepository`, preserving the previous repository in
   `external.previousSourceRepositories` as required by the branding migration.
   Keep identity values external. Review plans for accidental resource replacement.
4. Follow the repository's managed GitHub configuration procedure in
   [README.md](../README.md#git-hygiene). Rehearse infrastructure and release
   changes in GitHub Actions before applying. Coordinate OIDC trust changes so
   the new repository name can still obtain its deployment credentials.
5. Update every checkout's origin and dependent integration after the rename.
   Run `bun verify` and the hosted release rehearsal against the new identity;
   confirm authenticated deployment through the automated gates.
6. Audit public metadata again. Renames retain Git history and GitHub redirects;
   they do not erase the former name. Never claim the result is undiscoverable.

The repository has not been renamed by this patch. No history was rewritten,
external resources changed, or third-party license notices removed.
