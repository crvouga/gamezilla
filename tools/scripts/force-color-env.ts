/**
 * When stdout/stderr are piped for capture, children often disable ANSI because
 * they are not a TTY. If the parent process is still attached to a terminal,
 * force color so mirrored live output matches `stdio: 'inherit'`.
 */
export function withForcedColorEnv(
  base: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base };
  const noColor = env['NO_COLOR'] !== undefined && env['NO_COLOR'] !== '';
  const forceOff = env['FORCE_COLOR'] === '0';
  const parentIsTty = Boolean(process.stdout.isTTY || process.stderr.isTTY);
  if (!noColor && !forceOff && parentIsTty) {
    env['FORCE_COLOR'] = env['FORCE_COLOR'] ?? '1';
    env['CLICOLOR_FORCE'] = env['CLICOLOR_FORCE'] ?? '1';
  }
  return env;
}
