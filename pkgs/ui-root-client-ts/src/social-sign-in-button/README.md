# Social sign-in

The production contract is documented in `index.tsx` and exercised by the
colocated stories. Google uses its official full-color gradient G, Google Sans
Medium 14/20, 12px outer padding and 10px between the 20px mark and label.
Light, dark and neutral palettes follow
[Google’s published specification](https://developers.google.com/identity/branding-guidelines).

Google Sans files are self-hosted Latin and Latin Extended subsets for the
shipped English locale. Add matching subsets when introducing other scripts. They are downloaded from Google Fonts on
2026-10-30, licensed under the accompanying `license.txt`. There are no runtime
font or artwork requests to Google. Google Sans applies only to Google sign-in controls; other providers inherit
the application’s self-hosted Manrope so screenshots do not depend on installed
platform fonts.
