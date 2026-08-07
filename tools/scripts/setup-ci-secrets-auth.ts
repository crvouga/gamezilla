#!/usr/bin/env bun
import { join } from 'node:path';
/**
 * Idempotent setup for CI → secrets-backend OIDC auth.
 *
 * The deployment pipeline authenticates via GitHub Actions OIDC
 * (see `.github/actions/secrets-auth`). That requires two GitHub Actions
 * repository variables that are NOT stored in the secret store:
 *
 *   - SECRETS_PROJECT_ID   — secrets-action project *slug* for injection
 *                            (workspace UUID for CLI comes from `.secrets.json`)
 *   - SECRETS_IDENTITY_ID  — machine identity configured for GitHub OIDC
 *
 * This script makes the whole chain reproducible and safe to re-run. It also
 * migrates legacy provider-named GitHub variables when present.
 *
 * Auth (needs org admin rights for identity reconciliation), resolved in this order:
 *   1. SECRETS_TOKEN (or legacy provider token env inside the adapter)
 *   2. Universal-auth client credentials (adapter-private)
 *   3. Logged-in secrets CLI session (adapter-private)
 *
 * Flags:
 *   --repo <owner/name>   Override the GitHub repo (default: `gh` current repo)
 *   --identity-name <s>   Machine identity name (default: github-actions-<repo>)
 *   --dry-run             Print planned changes without applying them.
 */
import { reconcileCiSecretsAuth } from '@pkgs/secret-provider';

const REPO_ROOT = join(import.meta.dirname, '../..');

type Cli = {
  readonly repo: string | null;
  readonly identityName: string | null;
  readonly dryRun: boolean;
};

function parseCli(argv: readonly string[]): Cli {
  let repo: string | null = null;
  let identityName: string | null = null;
  let dryRun = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--repo') repo = argv[(i += 1)] ?? null;
    else if (arg === '--identity-name') identityName = argv[(i += 1)] ?? null;
  }
  return { repo, identityName, dryRun };
}

async function main(): Promise<void> {
  const cli = parseCli(process.argv.slice(2));
  try {
    await reconcileCiSecretsAuth({
      repoRoot: REPO_ROOT,
      repo: cli.repo,
      identityName: cli.identityName,
      dryRun: cli.dryRun,
      log: (message) => console.log(`[setup-ci-secrets-auth] ${message}`),
    });
  } catch (e) {
    console.error(
      `[setup-ci-secrets-auth] ERROR: ${e instanceof Error ? e.message : String(e)}`
    );
    process.exit(1);
  }
}

await main();
