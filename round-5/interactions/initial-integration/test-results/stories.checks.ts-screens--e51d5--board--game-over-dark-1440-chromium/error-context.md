# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--game-over dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  137905 pixels (ratio 0.12 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/game-over-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/game-over-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 137905 pixels (ratio 0.12 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - captured a stable screenshot
  - 137905 pixels (ratio 0.12 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e15]:
    - generic [ref=e16]:
      - heading "Word Tiles" [level=1] [ref=e19]
      - generic [ref=e21]:
        - generic [ref=e22]: Unrated
        - generic [ref=e23]: ·Untimed
    - generic [ref=e24]:
      - generic [ref=e26]:
        - heading "You win" [level=2] [ref=e28]
        - group "What next" [ref=e29]:
          - button "Rematch" [ref=e30] [cursor=pointer]:
            - paragraph [ref=e33]: Rematch
          - button "Change game" [ref=e34] [cursor=pointer]:
            - paragraph [ref=e37]: Change game
          - button "Review" [ref=e38] [cursor=pointer]:
            - paragraph [ref=e41]: Review
      - generic [ref=e42]:
        - generic [ref=e44]:
          - generic [ref=e46]:
            - generic [ref=e50]:
              - generic [ref=e51]:
                - img "Teal" [ref=e52]
                - generic "jordan_plays" [ref=e55]
              - generic [ref=e58]: 2 tiles
            - generic [ref=e59]:
              - generic [ref=e60]: Score
              - generic [ref=e61]: "154"
          - generic [ref=e63]:
            - group "Your rack" [ref=e64]
            - generic [ref=e65]:
              - generic [ref=e66]:
                - button "Fit board" [pressed] [ref=e67] [cursor=pointer]:
                  - paragraph [ref=e70]: Fit board
                - button "Enlarge board" [ref=e71] [cursor=pointer]:
                  - paragraph [ref=e74]: Enlarge board
              - region "Scrollable word board" [ref=e76]:
                - group "Word board, fifteen columns and fifteen rows" [ref=e77]:
                  - generic [ref=e79]: a
                  - generic [ref=e80]: b
                  - generic [ref=e81]: c
                  - generic [ref=e82]: d
                  - generic [ref=e83]: e
                  - generic [ref=e84]: f
                  - generic [ref=e85]: g
                  - generic [ref=e86]: h
                  - generic [ref=e87]: i
                  - generic [ref=e88]: j
                  - generic [ref=e89]: k
                  - generic [ref=e90]: l
                  - generic [ref=e91]: m
                  - generic [ref=e92]: "n"
                  - generic [ref=e93]: o
                  - generic [ref=e94]: "1"
                  - button "2L, a1, double letter, empty" [disabled] [ref=e95]:
                    - generic [ref=e96]: 2L
                  - button "b1, empty" [disabled] [ref=e97]
                  - button "c1, empty" [disabled] [ref=e98]
                  - button "d1, empty" [disabled] [ref=e99]
                  - button "3W, e1, triple word, empty" [disabled] [ref=e100]:
                    - generic [ref=e101]: 3W
                  - button "f1, empty" [disabled] [ref=e102]
                  - button "g1, empty" [disabled] [ref=e103]
                  - button "2L, h1, double letter, empty" [disabled] [ref=e104]:
                    - generic [ref=e105]: 2L
                  - button "i1, empty" [disabled] [ref=e106]
                  - button "j1, empty" [disabled] [ref=e107]
                  - button "3W, k1, triple word, empty" [disabled] [ref=e108]:
                    - generic [ref=e109]: 3W
                  - button "l1, empty" [disabled] [ref=e110]
                  - button "m1, empty" [disabled] [ref=e111]
                  - button "n1, empty" [disabled] [ref=e112]
                  - button "2L, o1, double letter, empty" [disabled] [ref=e113]:
                    - generic [ref=e114]: 2L
                  - generic [ref=e115]: "2"
                  - button "a2, empty" [disabled] [ref=e116]
                  - button "b2, empty" [disabled] [ref=e117]
                  - button "c2, empty" [disabled] [ref=e118]
                  - button "2L, d2, double letter, empty" [disabled] [ref=e119]:
                    - generic [ref=e120]: 2L
                  - button "e2, empty" [disabled] [ref=e121]
                  - button "f2, empty" [disabled] [ref=e122]
                  - button "2W, g2, double word, empty" [disabled] [ref=e123]:
                    - generic [ref=e124]: 2W
                  - button "h2, empty" [disabled] [ref=e125]
                  - button "2W, i2, double word, empty" [disabled] [ref=e126]:
                    - generic [ref=e127]: 2W
                  - button "j2, empty" [disabled] [ref=e128]
                  - button "k2, empty" [disabled] [ref=e129]
                  - button "2L, l2, double letter, empty" [disabled] [ref=e130]:
                    - generic [ref=e131]: 2L
                  - button "m2, empty" [disabled] [ref=e132]
                  - button "n2, empty" [disabled] [ref=e133]
                  - button "o2, empty" [disabled] [ref=e134]
                  - generic [ref=e135]: "3"
                  - button "a3, empty" [disabled] [ref=e136]
                  - button "b3, empty" [disabled] [ref=e137]
                  - button "c3, empty" [disabled] [ref=e138]
                  - button "d3, empty" [disabled] [ref=e139]
                  - button "3L, e3, triple letter, empty" [disabled] [ref=e140]:
                    - generic [ref=e141]: 3L
                  - button "f3, empty" [disabled] [ref=e142]
                  - button "g3, empty" [disabled] [ref=e143]
                  - button "h3, empty" [disabled] [ref=e144]
                  - button "i3, empty" [disabled] [ref=e145]
                  - button "j3, empty" [disabled] [ref=e146]
                  - button "3L, k3, triple letter, empty" [disabled] [ref=e147]:
                    - generic [ref=e148]: 3L
                  - button "l3, empty" [disabled] [ref=e149]
                  - button "m3, empty" [disabled] [ref=e150]
                  - button "n3, empty" [disabled] [ref=e151]
                  - button "o3, empty" [disabled] [ref=e152]
                  - generic [ref=e153]: "4"
                  - button "a4, empty" [disabled] [ref=e154]
                  - button "2L, b4, double letter, empty" [disabled] [ref=e155]:
                    - generic [ref=e156]: 2L
                  - button "c4, empty" [disabled] [ref=e157]
                  - button "2W, d4, double word, empty" [disabled] [ref=e158]:
                    - generic [ref=e159]: 2W
                  - button "e4, empty" [disabled] [ref=e160]
                  - button "f4, empty" [disabled] [ref=e161]
                  - button "g4, empty" [disabled] [ref=e162]
                  - button "h4, empty" [disabled] [ref=e163]
                  - button "i4, empty" [disabled] [ref=e164]
                  - button "j4, empty" [disabled] [ref=e165]
                  - button "k4, empty" [disabled] [ref=e166]
                  - button "2W, l4, double word, empty" [disabled] [ref=e167]:
                    - generic [ref=e168]: 2W
                  - button "m4, empty" [disabled] [ref=e169]
                  - button "2L, n4, double letter, empty" [disabled] [ref=e170]:
                    - generic [ref=e171]: 2L
                  - button "o4, empty" [disabled] [ref=e172]
                  - generic [ref=e173]: "5"
                  - button "3W, a5, triple word, empty" [disabled] [ref=e174]:
                    - generic [ref=e175]: 3W
                  - button "b5, empty" [disabled] [ref=e176]
                  - button "3L, c5, triple letter, empty" [disabled] [ref=e177]:
                    - generic [ref=e178]: 3L
                  - button "d5, empty" [disabled] [ref=e179]
                  - button "e5, empty" [disabled] [ref=e180]
                  - button "f5, empty" [disabled] [ref=e181]
                  - button "2L, g5, double letter, empty" [disabled] [ref=e182]:
                    - generic [ref=e183]: 2L
                  - button "h5, empty" [disabled] [ref=e184]
                  - button "2L, i5, double letter, empty" [disabled] [ref=e185]:
                    - generic [ref=e186]: 2L
                  - button "j5, empty" [disabled] [ref=e187]
                  - button "k5, empty" [disabled] [ref=e188]
                  - button "l5, empty" [disabled] [ref=e189]
                  - button "3L, m5, triple letter, empty" [disabled] [ref=e190]:
                    - generic [ref=e191]: 3L
                  - button "n5, empty" [disabled] [ref=e192]
                  - button "3W, o5, triple word, empty" [disabled] [ref=e193]:
                    - generic [ref=e194]: 3W
                  - generic [ref=e195]: "6"
                  - button "a6, empty" [disabled] [ref=e196]
                  - button "b6, empty" [disabled] [ref=e197]
                  - button "c6, empty" [disabled] [ref=e198]
                  - button "d6, empty" [disabled] [ref=e199]
                  - button "e6, empty" [disabled] [ref=e200]
                  - button "f6, empty" [disabled] [ref=e201]
                  - button "g6, empty" [disabled] [ref=e202]
                  - button "3L, h6, triple letter, empty" [disabled] [ref=e203]:
                    - generic [ref=e204]: 3L
                  - button "i6, empty" [disabled] [ref=e205]
                  - button "j6, empty" [disabled] [ref=e206]
                  - button "k6, empty" [disabled] [ref=e207]
                  - button "l6, empty" [disabled] [ref=e208]
                  - button "m6, empty" [disabled] [ref=e209]
                  - button "n6, empty" [disabled] [ref=e210]
                  - button "o6, empty" [disabled] [ref=e211]
                  - generic [ref=e212]: "7"
                  - button "a7, empty" [disabled] [ref=e213]
                  - button "2W, b7, double word, empty" [disabled] [ref=e214]:
                    - generic [ref=e215]: 2W
                  - button "c7, empty" [disabled] [ref=e216]
                  - button "d7, empty" [disabled] [ref=e217]
                  - button "2L, e7, double letter, empty" [disabled] [ref=e218]:
                    - generic [ref=e219]: 2L
                  - button "f7, empty" [disabled] [ref=e220]
                  - button "2L, g7, double letter, empty" [disabled] [ref=e221]:
                    - generic [ref=e222]: 2L
                  - button "h7, empty" [disabled] [ref=e223]
                  - button "2L, i7, double letter, empty" [disabled] [ref=e224]:
                    - generic [ref=e225]: 2L
                  - button "j7, empty" [disabled] [ref=e226]
                  - button "2L, k7, double letter, empty" [disabled] [ref=e227]:
                    - generic [ref=e228]: 2L
                  - button "l7, empty" [disabled] [ref=e229]
                  - button "m7, empty" [disabled] [ref=e230]
                  - button "2W, n7, double word, empty" [disabled] [ref=e231]:
                    - generic [ref=e232]: 2W
                  - button "o7, empty" [disabled] [ref=e233]
                  - generic [ref=e234]: "8"
                  - button "2L, a8, double letter, empty" [disabled] [ref=e235]:
                    - generic [ref=e236]: 2L
                  - button "b8, empty" [disabled] [ref=e237]
                  - button "c8, empty" [disabled] [ref=e238]
                  - button "d8, empty" [disabled] [ref=e239]
                  - button "e8, empty" [disabled] [ref=e240]
                  - button "3L, f8, triple letter, empty" [disabled] [ref=e241]:
                    - generic [ref=e242]: 3L
                  - button "C 3, g8, committed" [disabled] [ref=e243]:
                    - generic [ref=e244]: C
                    - generic [ref=e245]: "3"
                  - button "A 1, h8, committed" [disabled] [ref=e246]:
                    - generic [ref=e247]: A
                    - generic [ref=e248]: "1"
                  - button "T 1, i8, committed" [disabled] [ref=e249]:
                    - generic [ref=e250]: T
                    - generic [ref=e251]: "1"
                  - button "3L, j8, triple letter, empty" [disabled] [ref=e252]:
                    - generic [ref=e253]: 3L
                  - button "k8, empty" [disabled] [ref=e254]
                  - button "l8, empty" [disabled] [ref=e255]
                  - button "m8, empty" [disabled] [ref=e256]
                  - button "n8, empty" [disabled] [ref=e257]
                  - button "2L, o8, double letter, empty" [disabled] [ref=e258]:
                    - generic [ref=e259]: 2L
                  - generic [ref=e260]: "9"
                  - button "a9, empty" [disabled] [ref=e261]
                  - button "2W, b9, double word, empty" [disabled] [ref=e262]:
                    - generic [ref=e263]: 2W
                  - button "c9, empty" [disabled] [ref=e264]
                  - button "d9, empty" [disabled] [ref=e265]
                  - button "2L, e9, double letter, empty" [disabled] [ref=e266]:
                    - generic [ref=e267]: 2L
                  - button "f9, empty" [disabled] [ref=e268]
                  - button "2L, g9, double letter, empty" [disabled] [ref=e269]:
                    - generic [ref=e270]: 2L
                  - button "h9, empty" [disabled] [ref=e271]
                  - button "O 1, i9, committed" [disabled] [ref=e272]:
                    - generic [ref=e273]: O
                    - generic [ref=e274]: "1"
                  - button "j9, empty" [disabled] [ref=e275]
                  - button "2L, k9, double letter, empty" [disabled] [ref=e276]:
                    - generic [ref=e277]: 2L
                  - button "l9, empty" [disabled] [ref=e278]
                  - button "m9, empty" [disabled] [ref=e279]
                  - button "2W, n9, double word, empty" [disabled] [ref=e280]:
                    - generic [ref=e281]: 2W
                  - button "o9, empty" [disabled] [ref=e282]
                  - generic [ref=e283]: "10"
                  - button "a10, empty" [disabled] [ref=e284]
                  - button "b10, empty" [disabled] [ref=e285]
                  - button "c10, empty" [disabled] [ref=e286]
                  - button "d10, empty" [disabled] [ref=e287]
                  - button "e10, empty" [disabled] [ref=e288]
                  - button "f10, empty" [disabled] [ref=e289]
                  - button "g10, empty" [disabled] [ref=e290]
                  - button "3L, h10, triple letter, empty" [disabled] [ref=e291]:
                    - generic [ref=e292]: 3L
                  - button "E 1, i10, committed" [disabled] [ref=e293]:
                    - generic [ref=e294]: E
                    - generic [ref=e295]: "1"
                  - button "j10, empty" [disabled] [ref=e296]
                  - button "k10, empty" [disabled] [ref=e297]
                  - button "l10, empty" [disabled] [ref=e298]
                  - button "m10, empty" [disabled] [ref=e299]
                  - button "n10, empty" [disabled] [ref=e300]
                  - button "o10, empty" [disabled] [ref=e301]
                  - generic [ref=e302]: "11"
                  - button "3W, a11, triple word, empty" [disabled] [ref=e303]:
                    - generic [ref=e304]: 3W
                  - button "b11, empty" [disabled] [ref=e305]
                  - button "3L, c11, triple letter, empty" [disabled] [ref=e306]:
                    - generic [ref=e307]: 3L
                  - button "d11, empty" [disabled] [ref=e308]
                  - button "e11, empty" [disabled] [ref=e309]
                  - button "f11, empty" [disabled] [ref=e310]
                  - button "2L, g11, double letter, empty" [disabled] [ref=e311]:
                    - generic [ref=e312]: 2L
                  - button "h11, empty" [disabled] [ref=e313]
                  - button "2L, i11, double letter, empty" [disabled] [ref=e314]:
                    - generic [ref=e315]: 2L
                  - button "j11, empty" [disabled] [ref=e316]
                  - button "k11, empty" [disabled] [ref=e317]
                  - button "l11, empty" [disabled] [ref=e318]
                  - button "3L, m11, triple letter, empty" [disabled] [ref=e319]:
                    - generic [ref=e320]: 3L
                  - button "n11, empty" [disabled] [ref=e321]
                  - button "3W, o11, triple word, empty" [disabled] [ref=e322]:
                    - generic [ref=e323]: 3W
                  - generic [ref=e324]: "12"
                  - button "a12, empty" [disabled] [ref=e325]
                  - button "2L, b12, double letter, empty" [disabled] [ref=e326]:
                    - generic [ref=e327]: 2L
                  - button "c12, empty" [disabled] [ref=e328]
                  - button "2W, d12, double word, empty" [disabled] [ref=e329]:
                    - generic [ref=e330]: 2W
                  - button "e12, empty" [disabled] [ref=e331]
                  - button "f12, empty" [disabled] [ref=e332]
                  - button "g12, empty" [disabled] [ref=e333]
                  - button "h12, empty" [disabled] [ref=e334]
                  - button "i12, empty" [disabled] [ref=e335]
                  - button "j12, empty" [disabled] [ref=e336]
                  - button "k12, empty" [disabled] [ref=e337]
                  - button "2W, l12, double word, empty" [disabled] [ref=e338]:
                    - generic [ref=e339]: 2W
                  - button "m12, empty" [disabled] [ref=e340]
                  - button "2L, n12, double letter, empty" [disabled] [ref=e341]:
                    - generic [ref=e342]: 2L
                  - button "o12, empty" [disabled] [ref=e343]
                  - generic [ref=e344]: "13"
                  - button "a13, empty" [disabled] [ref=e345]
                  - button "b13, empty" [disabled] [ref=e346]
                  - button "c13, empty" [disabled] [ref=e347]
                  - button "d13, empty" [disabled] [ref=e348]
                  - button "3L, e13, triple letter, empty" [disabled] [ref=e349]:
                    - generic [ref=e350]: 3L
                  - button "f13, empty" [disabled] [ref=e351]
                  - button "g13, empty" [disabled] [ref=e352]
                  - button "h13, empty" [disabled] [ref=e353]
                  - button "i13, empty" [disabled] [ref=e354]
                  - button "j13, empty" [disabled] [ref=e355]
                  - button "3L, k13, triple letter, empty" [disabled] [ref=e356]:
                    - generic [ref=e357]: 3L
                  - button "l13, empty" [disabled] [ref=e358]
                  - button "m13, empty" [disabled] [ref=e359]
                  - button "n13, empty" [disabled] [ref=e360]
                  - button "o13, empty" [disabled] [ref=e361]
                  - generic [ref=e362]: "14"
                  - button "a14, empty" [disabled] [ref=e363]
                  - button "b14, empty" [disabled] [ref=e364]
                  - button "c14, empty" [disabled] [ref=e365]
                  - button "2L, d14, double letter, empty" [disabled] [ref=e366]:
                    - generic [ref=e367]: 2L
                  - button "e14, empty" [disabled] [ref=e368]
                  - button "f14, empty" [disabled] [ref=e369]
                  - button "2W, g14, double word, empty" [disabled] [ref=e370]:
                    - generic [ref=e371]: 2W
                  - button "h14, empty" [disabled] [ref=e372]
                  - button "2W, i14, double word, empty" [disabled] [ref=e373]:
                    - generic [ref=e374]: 2W
                  - button "j14, empty" [disabled] [ref=e375]
                  - button "k14, empty" [disabled] [ref=e376]
                  - button "2L, l14, double letter, empty" [disabled] [ref=e377]:
                    - generic [ref=e378]: 2L
                  - button "m14, empty" [disabled] [ref=e379]
                  - button "n14, empty" [disabled] [ref=e380]
                  - button "o14, empty" [disabled] [ref=e381]
                  - generic [ref=e382]: "15"
                  - button "2L, a15, double letter, empty" [disabled] [ref=e383]:
                    - generic [ref=e384]: 2L
                  - button "b15, empty" [disabled] [ref=e385]
                  - button "c15, empty" [disabled] [ref=e386]
                  - button "d15, empty" [disabled] [ref=e387]
                  - button "3W, e15, triple word, empty" [disabled] [ref=e388]:
                    - generic [ref=e389]: 3W
                  - button "f15, empty" [disabled] [ref=e390]
                  - button "g15, empty" [disabled] [ref=e391]
                  - button "2L, h15, double letter, empty" [disabled] [ref=e392]:
                    - generic [ref=e393]: 2L
                  - button "i15, empty" [disabled] [ref=e394]
                  - button "j15, empty" [disabled] [ref=e395]
                  - button "3W, k15, triple word, empty" [disabled] [ref=e396]:
                    - generic [ref=e397]: 3W
                  - button "l15, empty" [disabled] [ref=e398]
                  - button "m15, empty" [disabled] [ref=e399]
                  - button "n15, empty" [disabled] [ref=e400]
                  - button "2L, o15, double letter, empty" [disabled] [ref=e401]:
                    - generic [ref=e402]: 2L
          - status [ref=e404]:
            - generic [ref=e405]:
              - generic [ref=e406]: "Amber: avery. Teal: jordan_plays."
              - text: A player used their last tile with the bag empty. Everyone else's tiles count against them and go to that player.
          - generic [ref=e409]:
            - generic [ref=e413]:
              - generic [ref=e414]:
                - img "Amber" [ref=e415]
                - generic "avery" [ref=e418]
              - generic [ref=e421]: 0 tiles
            - generic [ref=e422]:
              - generic [ref=e423]: Score
              - generic [ref=e424]: "187"
        - list "Standings" [ref=e427]:
          - listitem [ref=e428]:
            - generic [ref=e429]:
              - generic [ref=e430]: 1st
              - generic [ref=e433]: avery
              - generic [ref=e434]:
                - generic [ref=e435]: Score
                - text: "187"
          - listitem [ref=e436]:
            - generic [ref=e437]:
              - generic [ref=e438]: 2nd
              - generic [ref=e441]: jordan_plays
              - generic [ref=e442]:
                - generic [ref=e443]: Score
                - text: "154"
        - region "Game record" [ref=e446]:
          - generic [ref=e447]:
            - heading "Game record" [level=2] [ref=e449]
            - paragraph [ref=e450]: A player used their last tile with the bag empty. Everyone else's tiles count against them and go to that player.
          - button "History and stats" [ref=e453] [cursor=pointer]:
            - paragraph [ref=e456]: History and stats
```

# Test source

```ts
  1  | // @io-wall-ok — browser verification adapter; all requests stay on the static server.
  2  | import { expect, type Page } from '@playwright/test';
  3  | import axe from 'axe-core';
  4  | import type { visualScenarios } from '../../storybook/scenarios';
  5  | 
  6  | /** The same readiness, accessibility and pixel contract for every canvas. */
  7  | export async function verifyStoryScenario(
  8  |   page: Page,
  9  |   storyId: string,
  10 |   scenario: ReturnType<typeof visualScenarios>[number]
  11 | ): Promise<void> {
  12 |   const { width, height, theme } = scenario;
  13 |   await page.setViewportSize({ width, height });
  14 |   const failures: string[] = [];
  15 |   page.on('pageerror', (error) => failures.push(error.message));
  16 |   await page.route('**/*', (route) =>
  17 |     new URL(route.request().url()).hostname === '127.0.0.1'
  18 |       ? route.continue()
  19 |       : route.abort()
  20 |   );
  21 |   await page.goto(
  22 |     `/iframe.html?id=${storyId}&viewMode=story&globals=theme:${theme}`
  23 |   );
  24 |   await expect
  25 |     .poll(async () =>
  26 |       page.locator('#storybook-root').evaluate((root) => {
  27 |         const status = root.getAttribute('data-story-status');
  28 |         if (status === 'error')
  29 |           return `error: ${root.getAttribute('data-story-error') ?? 'Storybook reported a failure'}`;
  30 |         return root.getAttribute('data-story-ready') === 'true'
  31 |           ? 'success'
  32 |           : 'pending';
  33 |       })
  34 |     )
  35 |     .toBe('success');
  36 |   await expect(page.locator('.sb-errordisplay')).not.toBeVisible();
  37 |   await page.evaluate(() => document.fonts.ready);
  38 |   await page.addScriptTag({ content: axe.source });
  39 |   const violations = await page.evaluate(async () => {
  40 |     const root = document.querySelector<HTMLElement>('#storybook-root');
  41 |     if (!root) throw new Error('Storybook canvas is missing');
  42 |     const result = await (window as unknown as { axe: typeof axe }).axe.run(
  43 |       root
  44 |     );
  45 |     return result.violations.filter(
  46 |       (v) => v.impact === 'serious' || v.impact === 'critical'
  47 |     );
  48 |   });
  49 |   expect(violations).toEqual([]);
  50 |   expect(failures).toEqual([]);
> 51 |   await expect(page.locator('#storybook-root')).toHaveScreenshot(
     |                                                 ^ Error: expect(locator).toHaveScreenshot(expected) failed
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```