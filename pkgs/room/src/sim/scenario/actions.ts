/** One app-level command from one client, as the `domain` action's argument. */
export type DomainOp = {
  readonly kind: 'domain';
  readonly clientId: string;
  readonly command: string;
  readonly args: Record<string, unknown>;
};

export function domainOp(
  clientId: string,
  command: string,
  args: Record<string, unknown> = {}
): DomainOp {
  return { kind: 'domain', clientId, command, args };
}
