export type InfisicalProject = {
  readonly workspaceId: string;
  readonly domain: string;
  readonly env: string;
};

type AuthEnvironment = Readonly<Record<string, string | undefined>>;

/** The Infisical CLI refuses a profile name longer than this. */
const PROFILE_NAME_MAX = 64;

/** FNV-1a (32-bit) of the UTF-8 bytes, as 8 lower-case hex digits. */
function shortHash(text: string): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text))
    hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  return hash.toString(16).padStart(8, '0');
}

/**
 * Shared by every checkout of a project; never the machine's default profile.
 * The Infisical origin is named by a short hash, so the name stays within the
 * CLI's limit while each domain and workspace still has a profile of its own.
 */
export function infisicalProjectProfile(
  project: Pick<InfisicalProject, 'workspaceId' | 'domain'>,
  env: AuthEnvironment
): string {
  const override = env['SECRETS_PROFILE']?.trim();
  if (override) return override;
  const origin = new URL(project.domain).origin;
  const readable = `project-${shortHash(origin)}-${project.workspaceId}`;
  if (readable.length <= PROFILE_NAME_MAX) return readable;
  return `project-${shortHash(`${origin}\n${project.workspaceId}`)}`;
}

/** Tokens authenticate CI without requiring a local user profile. */
export function infisicalProjectArgs(
  project: InfisicalProject,
  env: AuthEnvironment
): string[] {
  const token = [
    'SECRETS_TOKEN',
    'INFISICAL_TOKEN',
    'INFISICAL_ACCESS_TOKEN',
  ].some((key) => Boolean(env[key]?.trim()));
  return [
    '--projectId',
    project.workspaceId,
    '--env',
    project.env,
    '--domain',
    project.domain,
    ...(token ? [] : ['--profile', infisicalProjectProfile(project, env)]),
  ];
}

/** A different project's terminal pins must not change this project's organization. */
export function infisicalProjectEnv(
  env: AuthEnvironment
): Record<string, string | undefined> {
  const child: Record<string, string | undefined> = {
    ...env,
    INFISICAL_DISABLE_MIGRATION_NOTICE: '1',
  };
  delete child['INFISICAL_PROFILE'];
  delete child['INFISICAL_ORG'];
  return child;
}
