# Sound Asset Licenses

All assets committed to `@pkgs/sounds` must be **CC0 / public domain** or equivalent unrestricted redistribution.

## Committed assets (Tier 1)

| Source                  | License | URL                                       | Notes                               |
| ----------------------- | ------- | ----------------------------------------- | ----------------------------------- |
| Kenney Interface Sounds | CC0 1.0 | https://kenney.nl/assets/interface-sounds | Optional credit: Kenney (kenney.nl) |
| Kenney UI Audio         | CC0 1.0 | https://kenney.nl/assets/ui-audio         | Optional credit: Kenney (kenney.nl) |
| Kenney Music Jingles    | CC0 1.0 | https://kenney.nl/assets/music-jingles    | Pizzicato subset only               |
| Kenney Digital Audio    | CC0 1.0 | https://kenney.nl/assets/digital-audio    |                                     |
| Kenney Impact Sounds    | CC0 1.0 | https://kenney.nl/assets/impact-sounds    |                                     |
| Kenney RPG Audio        | CC0 1.0 | https://kenney.nl/assets/rpg-audio        |                                     |
| Kenney Casino Audio     | CC0 1.0 | https://kenney.nl/assets/casino-audio     |                                     |
| Kenney Sci-Fi Sounds    | CC0 1.0 | https://kenney.nl/assets/sci-fi-sounds    |                                     |

CC0 text: https://creativecommons.org/publicdomain/zero/1.0/

## Do NOT commit (Tier 3)

These are royalty-free for **embedded use in shipped apps** but **forbid redistributing raw files as a sound library** in a public repo:

| Source                         | License                    | Restriction                                           |
| ------------------------------ | -------------------------- | ----------------------------------------------------- |
| Sonniss GDC Game Audio Bundles | Sonniss GDC Bundle License | No standalone / library redistribution                |
| Shapeforms Audio Free SFX      | Shapeforms royalty-free    | No redistribution as sample pack; repo commit unclear |

Use Kenney CC0 packs for all in-repo assets. Tier 3 sources may be used locally for reference only.

## Verification

Run `bun run --filter @pkgs/sounds verify:licenses` to ensure every manifest entry has a recognized license and source URL.
