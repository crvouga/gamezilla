/**
 * Google's measured Material values, light scheme.
 *
 * ── measured on the live sign-in page (`getComputedStyle`) ───────────────────
 * surface / on-surface         `#ffffff` / `#1f1f1f`
 * on-surface-variant           `#444746`  — floating labels, footers
 * outline / outline-focus      `#747775` / `#0b57d0`  (1px idle, 2px focus)
 * primary / on-primary         `#0b57d0` / `#ffffff`
 * state-hover surface          `#f2f2f2`
 * divider                      `#c4c7c5`
 * error                        `#b3261e`
 * field                        56px tall, 4px radius, 1px → 2px outline,
 *                              padding `13px 15px`, 16px text
 * floating label               16px idle → 12px floated, white background,
 *                              `padding: 0 8px`, top edge when floated
 * button (filled / text)       40px tall, 20px radius, `padding: 0 24px`
 * link                         14px / 500, `#0b57d0`, underline on hover only
 * card (app-continue variant)  448px wide, `1px solid #747775`, 28px radius,
 *                              `padding: 48px 40px 36px`  — Google answers 400
 *                              to `?continue=`, so this is the documented
 *                              app-variant card, not a measured one
 * headline                     24px / 32px / 400; subtitle 16px / 24px
 * account row                  56px min-height, 32px avatar, 14px text,
 *                              hover `#f2f2f2`, radius 8px
 * scope row                    20px icon `#444746`, 14px label, 16px gap
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Everything the components can express as a utility lives in `styles.css` as
 * a `gm-*` token. Only values that must be read in JavaScript — the wordmark's
 * geometry and colours — are here.
 */

export const GOOGLE_MATERIAL = {
  logo: {
    /** In the card; the error screen gets the larger standalone mark. */
    size: 40,
    errorSize: 48,
    blue: '#4285f4',
    green: '#34a853',
    yellow: '#fbbc05',
    red: '#ea4335',
  },
} as const;
