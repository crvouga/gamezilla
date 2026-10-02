/** Unique durable namespaces whose epoch belongs to one harness. */
let nextEpoch = 0;

export function createHarnessClientNamespaces(): {
  readonly namespace: (id: string) => string;
  readonly bump: () => void;
} {
  let epoch = ++nextEpoch;
  return {
    namespace: (id) => `harness_client_${id}_e${epoch}`,
    bump: () => {
      epoch = ++nextEpoch;
    },
  };
}
