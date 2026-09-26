/**
 * When is the sign-in method picker ready to show methods (or a definitive
 * "none configured" state)?
 *
 * Must NOT treat "local SQLite opened / paintReady" with zero `client_config`
 * rows as ready — that is the sync-not-yet-hydrated case and produces a false
 * "No authentication methods are configured" modal.
 */
export function resolveSignInCapabilitiesReady(args: {
  readonly isLoading: boolean;
  readonly methodsKnown: boolean;
  readonly configRowCount: number;
}): boolean {
  if (args.isLoading) return false;
  return args.methodsKnown || args.configRowCount > 0;
}
