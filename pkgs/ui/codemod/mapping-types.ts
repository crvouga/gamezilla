/**
 * Shared types for the sx → Tailwind mapping table (`sx-map-*.ts`,
 * composed by `sx-mapping.ts`).
 *
 * The table is pure data + pure functions: no file IO, no clock, no
 * randomness. Every entry maps one `SxProps` property to either Tailwind
 * classes (exact byte-equivalent declarations) or a bail reason. Anything
 * without an exact equivalent bails so callers fall back to Tier C.
 */

export type StaticValue = string | number | boolean | null;

/** Outcome of mapping one static sx property. */
export type StaticMapping =
  /** Emit these Tailwind classes. */
  | { readonly kind: 'classes'; readonly classes: readonly string[] }
  /** Runtime emits nothing for this value — drop it (exact). */
  | { readonly kind: 'omit' }
  /** No exact mapping — caller must leave the node for manual migration. */
  | { readonly kind: 'bail'; readonly reason: string };

/** How a dynamic (non-literal) value becomes a `style` binding. */
export type DynamicStyle =
  /** `style={{ [cssProp]: <expr> }}` with the expression transformation. */
  | {
      readonly kind: 'style';
      readonly cssProp: string;
      readonly wrap: DynamicWrap;
    }
  | { readonly kind: 'bail'; readonly reason: string };

/**
 * Expression wrapping for dynamic style values. `raw` splices the original
 * expression text verbatim; `px-number-or-string` emits
 * `typeof e === 'number' ? \`${e}px\` : e` (exact for `SxDimension`);
 * `scaled` emits `` `${(e) * 4}px` `` (exact for 4px-grid numbers).
 */
export type DynamicWrap = 'raw' | 'px-number-or-string' | 'scaled';

/** One Tailwind class the table can emit, with its exact declaration. */
export type EmittedClass = {
  readonly className: string;
  /** e.g. `padding:16px` — compared against the `sxToCss` oracle in tests. */
  readonly declaration: string;
};
