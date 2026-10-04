export type ReconcileAction = 'reuse' | 'create' | 'recreate';

/** The identifiers `simctl` rows carry that decide reuse vs recreate. */
export type ReconcileDeviceIdentity = {
  readonly deviceTypeIdentifier: string;
  readonly runtimeIdentifier: string;
};

/** Pure decision: whether to reuse, create, or delete-and-recreate a named sim. */
export function reconcileAction(
  spec: {
    readonly deviceType: string;
    readonly runtime: string;
  },
  existing: ReconcileDeviceIdentity | undefined,
  opts?: { readonly dataPresent?: boolean }
): ReconcileAction {
  if (existing === undefined) return 'create';
  if (opts?.dataPresent === false) return 'recreate';
  if (
    existing.deviceTypeIdentifier === spec.deviceType &&
    existing.runtimeIdentifier === spec.runtime
  ) {
    return 'reuse';
  }
  return 'recreate';
}
