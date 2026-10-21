/**
 * The shape of a design-system inventory: what the code says today, read
 * mechanically from source, before any of it is written down as a spec.
 */

/** One explorer entry, in registry order. */
export type RegistryEntry = {
  readonly order: number;
  readonly id: string;
  readonly title: string;
  readonly category: string;
  /** Module the entry's example lives in, e.g. `button.example`. */
  readonly exampleModule: string;
  /** Component modules the example imports, e.g. `button`. */
  readonly modules: readonly string[];
  /** The module the entry is about, or null when none can be told apart. */
  readonly primaryModule: string | null;
};

/** One prop of a component, as the type checker sees it. */
export type PropFact = {
  readonly name: string;
  readonly type: string;
  readonly optional: boolean;
  readonly doc: string;
  /** Default read from `props.x ?? <value>` or `mergeProps`, as source text. */
  readonly defaultText: string | null;
  /** The members of a literal union behind an alias (`ButtonSize`). */
  readonly values: readonly string[] | null;
};

/** An exported Solid component (callable, returns a JSX element). */
export type ComponentFact = {
  readonly name: string;
  readonly props: readonly PropFact[];
  /** Props inherited from DOM / library types, counted rather than listed. */
  readonly foreignPropCount: number;
};

/** A JSX attribute whose value is an expression, with its source text. */
export type AttributeFact = {
  readonly element: string;
  readonly name: string;
  readonly value: string;
};

/** What the markup of one module says. */
export type MarkupFact = {
  readonly dataComponents: readonly string[];
  readonly roles: readonly string[];
  readonly aria: readonly AttributeFact[];
  readonly domEvents: readonly AttributeFact[];
  readonly dataAttributes: readonly AttributeFact[];
  readonly tabIndex: readonly AttributeFact[];
  readonly classListStates: readonly AttributeFact[];
  readonly classes: readonly string[];
  readonly testIds: readonly string[];
  readonly keys: readonly string[];
  readonly globalKeyListeners: number;
  readonly defaults: ReadonlyMap<string, string>;
  readonly sharedModules: readonly string[];
};

/** Everything one source module contributes. */
export type ModuleFact = {
  readonly module: string;
  readonly file: string;
  readonly components: readonly ComponentFact[];
  readonly markup: MarkupFact;
  /** Keys handled by `@pkgs/ui-root-shared` logic modules it imports. */
  readonly sharedKeys: readonly string[];
};

export type LiteralKind =
  | 'color'
  | 'length'
  | 'duration'
  | 'z-index'
  | 'font'
  | 'easing'
  | 'opacity'
  | 'grid-utility'
  | 'numeric-constant';

/** A visual value written in source rather than read from a token. */
export type LiteralFact = {
  readonly file: string;
  readonly line: number;
  readonly kind: LiteralKind;
  readonly literal: string;
  readonly context: string;
};

/** One leaf of the token document. */
export type TokenFact = {
  readonly path: string;
  readonly type: string;
  readonly value: string;
  readonly alias: string | null;
  readonly description: string;
};

/** One custom property the compiled `tokens.css` declares. */
export type CssVarFact = {
  readonly block: string;
  readonly name: string;
  readonly value: string;
};

/** One stylesheet rule that declares something. */
export type CssRuleFact = {
  readonly file: string;
  /** Enclosing at-rules, outermost first (`@layer components › @media …`). */
  readonly context: string;
  readonly selector: string;
  readonly declarations: readonly string[];
};

export type Inventory = {
  readonly commit: string;
  readonly registry: readonly RegistryEntry[];
  readonly modules: readonly ModuleFact[];
  readonly tokens: readonly TokenFact[];
  readonly cssVars: readonly CssVarFact[];
  readonly literals: readonly LiteralFact[];
  readonly styles: readonly CssRuleFact[];
};
