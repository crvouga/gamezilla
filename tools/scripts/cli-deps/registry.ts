import type { CliDep } from '@pkgs/os';
import { actionlintCliDep } from './actionlint';
import { bunCliDep } from './bun';
import { ghCliDep } from './gh';
import { gitleaksCliDep } from './gitleaks';
import { infisicalCliDep } from './infisical';
import { nodeCliDep } from './node';
import { easCliDep, wranglerCliDep } from './npm-globals';
import { turboCliDep } from './turbo';
import { workspaceCliDep } from './workspace';

/** All monorepo CLI deps for `bun install-deps` (topo-sorted at install time). */
export const ALL_CLI_DEPS: readonly CliDep[] = [
  bunCliDep,
  nodeCliDep,
  workspaceCliDep,
  turboCliDep,
  infisicalCliDep,
  wranglerCliDep,
  easCliDep,
  gitleaksCliDep,
  actionlintCliDep,
  ghCliDep,
];
