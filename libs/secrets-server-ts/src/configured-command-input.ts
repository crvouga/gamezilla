/** Explicit verification opts out of deployment configuration; arguments stay verbatim. */
export function configuredCommandInput(
  args: readonly string[],
  environmentMode: string | undefined
): { readonly mode: 'fixture' | 'configured'; readonly command: string[] } {
  const command = [...args];
  const fixture = command[0] === '--fixture';
  if (fixture) command.shift();
  if (command[0] === '--') command.shift();
  if (command.length === 0) throw new Error('secrets-run: missing command');
  const mode = fixture ? 'fixture' : (environmentMode ?? 'configured');
  if (mode !== 'fixture' && mode !== 'configured')
    throw new Error('PRODUCT_IDENTITY_MODE must be fixture or configured');
  return { mode, command };
}
