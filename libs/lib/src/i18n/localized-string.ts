declare const localizedStringBrand: unique symbol;

/**
 * Opaque string produced only by Lingui `t` / `useLingui().t` (see `lingui-augmentation.d.ts`)
 * or {@link asLocalized} for rare escape hatches (third-party APIs, tests).
 */
export type LocalizedString = string & { readonly [localizedStringBrand]: typeof localizedStringBrand };

/** Escape hatch when a string is already localized by Lingui at runtime (e.g. `i18n._`). */
export function asLocalized(s: string): LocalizedString {
  return s as LocalizedString;
}
