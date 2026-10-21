const HOST_OPTION = '--host';

/** Keep the printed Atlas address unambiguous when several workspaces run. */
export function statechartExplorerFlags(
  flags: readonly string[]
): readonly string[] {
  const hasHost = flags.some(
    (flag) => flag === HOST_OPTION || flag.startsWith(`${HOST_OPTION}=`)
  );
  return hasHost ? flags : [HOST_OPTION, '127.0.0.1', ...flags];
}
