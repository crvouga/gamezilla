import type { Capability, Ports, Runtime, Session } from './types';

export function defineRuntime<P extends Ports>(def: {
  readonly caps: ReadonlySet<Capability> | readonly Capability[];
  readonly open: (seed: number | bigint | string) => Promise<Session<P>>;
}): Runtime<P> {
  const caps = def.caps instanceof Set ? def.caps : new Set(def.caps);

  const make = <Q extends Ports>(
    open: (seed: number | bigint | string) => Promise<Session<Q>>,
    hostCaps: ReadonlySet<Capability>
  ): Runtime<Q> => ({
    caps: hostCaps,
    open,
    with(extra) {
      return make(async (seed) => {
        const session = await open(seed);
        const added = await extra(session as unknown as Session<Q>);
        const ports = { ...session.ports, ...added } as Q & typeof added;
        return {
          ...session,
          ports,
          fork(name) {
            const child = session.fork(name);
            return {
              ...child,
              ports: { ...child.ports, ...added } as typeof ports,
            };
          },
        } as Session<Q & typeof added>;
      }, hostCaps) as unknown as Runtime<Q & Awaited<ReturnType<typeof extra>>>;
    },
  });

  return make(def.open, caps);
}
