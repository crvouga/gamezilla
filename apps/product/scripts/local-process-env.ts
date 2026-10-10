/** Only process plumbing crosses into a local stack; service bindings are explicit. */
export function localProcessEnv(
  source: Readonly<Record<string, string | undefined>>
): Record<string, string> {
  const names = [
    'PATH',
    'HOME',
    'USER',
    'LOGNAME',
    'SHELL',
    'TMPDIR',
    'TMP',
    'TEMP',
    'LANG',
    'LC_ALL',
    'TERM',
    'COLORTERM',
    'NO_COLOR',
    'FORCE_COLOR',
    'SYSTEMROOT',
    'SystemRoot',
    'BUN_INSTALL',
  ];
  return Object.fromEntries(
    names.flatMap((name) =>
      source[name] === undefined ? [] : [[name, source[name]]]
    )
  );
}
