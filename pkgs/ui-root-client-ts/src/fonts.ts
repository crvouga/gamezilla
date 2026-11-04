/**
 * One face, self-hosted with `font-display: swap`: Manrope 400 / 500 / 600 / 700
 * for every line of copy, headline and number (tabular figures). Each
 * file declares every subset by `unicode-range`, so a page fetches only the
 * subsets its text uses. Imported once by each app entry (and by
 * `mountApplication`), beside the design-system stylesheets.
 */

import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
