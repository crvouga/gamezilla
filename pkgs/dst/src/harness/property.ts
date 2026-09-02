export type PropertyAt = 'step' | 'converge';

export type PropertyKind = 'always' | 'eventually' | 'sometimes';

export type PropertyDef<S = unknown> = {
  readonly kind: PropertyKind;
  readonly at: PropertyAt;
  readonly check: (surface: S) => boolean | Promise<boolean>;
};

export type PropertyCatalog<S = unknown> = Record<string, PropertyDef<S>>;

type AlwaysOpts = { readonly at?: PropertyAt };

function always<S>(
  check: (surface: S) => boolean | Promise<boolean>,
  opts?: AlwaysOpts
): PropertyDef<S> {
  return { kind: 'always', at: opts?.at ?? 'step', check };
}

function eventually<S>(
  check: (surface: S) => boolean | Promise<boolean>
): PropertyDef<S> {
  return { kind: 'eventually', at: 'converge', check };
}

function sometimes<S>(
  check: (surface: S) => boolean | Promise<boolean>
): PropertyDef<S> {
  return { kind: 'sometimes', at: 'step', check };
}

export const property = { always, eventually, sometimes };

/** Double-call factory for Surface-typed property catalogs. */
export function properties<S>() {
  return <P extends PropertyCatalog<S>>(catalog: P): P => catalog;
}
