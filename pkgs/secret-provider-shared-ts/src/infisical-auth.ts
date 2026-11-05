export type InfisicalProject = {
  readonly workspaceId: string;
  readonly domain: string;
  readonly env: string;
};

type AuthEnvironment = Readonly<Record<string, string | undefined>>;

/** Shared by every checkout of a project; never the machine's default profile. */
export function infisicalProjectProfile(
  project: Pick<InfisicalProject, 'workspaceId' | 'domain'>,
  env: AuthEnvironment
): string {
  const override = env['SECRETS_PROFILE']?.trim();
  if (override) return override;
  const origin = new URL(project.domain).origin;
  return `project-${encodeURIComponent(origin).replaceAll('_', '%5F').replaceAll('%', '_')}-${project.workspaceId}`;
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
