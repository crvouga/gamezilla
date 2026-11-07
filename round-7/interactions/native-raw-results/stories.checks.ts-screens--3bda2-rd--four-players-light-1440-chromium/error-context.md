# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--four-players light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  198047 pixels (ratio 0.17 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/four-players-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/four-players-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 198047 pixels (ratio 0.17 of all image pixels) are different.
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
  - 198047 pixels (ratio 0.17 of all image pixels) are different.

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
      - generic [ref=e25]:
        - generic [ref=e27]:
          - list "Other players" [ref=e29]:
            - generic "jordan_plays" [ref=e30]:
              - listitem [ref=e31]:
                - generic [ref=e35]:
                  - generic [ref=e36]: jordan_plays
                  - generic [ref=e37]:
                    - generic [ref=e39]: Score 3
                    - generic [ref=e41]: 7 tiles
            - generic "morgan" [ref=e42]:
              - listitem [ref=e43]:
                - generic [ref=e47]:
                  - generic [ref=e48]: morgan
                  - generic [ref=e49]:
                    - generic [ref=e51]: Score 0
                    - generic [ref=e53]: 7 tiles
            - generic "robin_42" [ref=e54]:
              - listitem [ref=e55]:
                - generic [ref=e59]:
                  - generic [ref=e60]: robin_42
                  - generic [ref=e61]:
                    - generic [ref=e63]: Score 0
                    - generic [ref=e65]: 7 tiles
          - generic [ref=e67]:
            - paragraph [ref=e68]: You are watching. Racks stay private to their players.
            - generic [ref=e69]:
              - generic [ref=e70]:
                - button "Fit board" [pressed] [ref=e71] [cursor=pointer]:
                  - paragraph [ref=e74]: Fit board
                - button "Enlarge board" [ref=e75] [cursor=pointer]:
                  - paragraph [ref=e78]: Enlarge board
              - region "Scrollable word board" [ref=e80]:
                - group "Word board, fifteen columns and fifteen rows" [ref=e81]:
                  - generic [ref=e83]: a
                  - generic [ref=e84]: b
                  - generic [ref=e85]: c
                  - generic [ref=e86]: d
                  - generic [ref=e87]: e
                  - generic [ref=e88]: f
                  - generic [ref=e89]: g
                  - generic [ref=e90]: h
                  - generic [ref=e91]: i
                  - generic [ref=e92]: j
                  - generic [ref=e93]: k
                  - generic [ref=e94]: l
                  - generic [ref=e95]: m
                  - generic [ref=e96]: "n"
                  - generic [ref=e97]: o
                  - generic [ref=e98]: "1"
                  - button "2L, a1, double letter, empty" [disabled] [ref=e99]:
                    - generic [ref=e100]: 2L
                  - button "b1, empty" [disabled] [ref=e101]
                  - button "c1, empty" [disabled] [ref=e102]
                  - button "d1, empty" [disabled] [ref=e103]
                  - button "3W, e1, triple word, empty" [disabled] [ref=e104]:
                    - generic [ref=e105]: 3W
                  - button "f1, empty" [disabled] [ref=e106]
                  - button "g1, empty" [disabled] [ref=e107]
                  - button "2L, h1, double letter, empty" [disabled] [ref=e108]:
                    - generic [ref=e109]: 2L
                  - button "i1, empty" [disabled] [ref=e110]
                  - button "j1, empty" [disabled] [ref=e111]
                  - button "3W, k1, triple word, empty" [disabled] [ref=e112]:
                    - generic [ref=e113]: 3W
                  - button "l1, empty" [disabled] [ref=e114]
                  - button "m1, empty" [disabled] [ref=e115]
                  - button "n1, empty" [disabled] [ref=e116]
                  - button "2L, o1, double letter, empty" [disabled] [ref=e117]:
                    - generic [ref=e118]: 2L
                  - generic [ref=e119]: "2"
                  - button "a2, empty" [disabled] [ref=e120]
                  - button "b2, empty" [disabled] [ref=e121]
                  - button "c2, empty" [disabled] [ref=e122]
                  - button "2L, d2, double letter, empty" [disabled] [ref=e123]:
                    - generic [ref=e124]: 2L
                  - button "e2, empty" [disabled] [ref=e125]
                  - button "f2, empty" [disabled] [ref=e126]
                  - button "2W, g2, double word, empty" [disabled] [ref=e127]:
                    - generic [ref=e128]: 2W
                  - button "h2, empty" [disabled] [ref=e129]
                  - button "2W, i2, double word, empty" [disabled] [ref=e130]:
                    - generic [ref=e131]: 2W
                  - button "j2, empty" [disabled] [ref=e132]
                  - button "k2, empty" [disabled] [ref=e133]
                  - button "2L, l2, double letter, empty" [disabled] [ref=e134]:
                    - generic [ref=e135]: 2L
                  - button "m2, empty" [disabled] [ref=e136]
                  - button "n2, empty" [disabled] [ref=e137]
                  - button "o2, empty" [disabled] [ref=e138]
                  - generic [ref=e139]: "3"
                  - button "a3, empty" [disabled] [ref=e140]
                  - button "b3, empty" [disabled] [ref=e141]
                  - button "c3, empty" [disabled] [ref=e142]
                  - button "d3, empty" [disabled] [ref=e143]
                  - button "3L, e3, triple letter, empty" [disabled] [ref=e144]:
                    - generic [ref=e145]: 3L
                  - button "f3, empty" [disabled] [ref=e146]
                  - button "g3, empty" [disabled] [ref=e147]
                  - button "h3, empty" [disabled] [ref=e148]
                  - button "i3, empty" [disabled] [ref=e149]
                  - button "j3, empty" [disabled] [ref=e150]
                  - button "3L, k3, triple letter, empty" [disabled] [ref=e151]:
                    - generic [ref=e152]: 3L
                  - button "l3, empty" [disabled] [ref=e153]
                  - button "m3, empty" [disabled] [ref=e154]
                  - button "n3, empty" [disabled] [ref=e155]
                  - button "o3, empty" [disabled] [ref=e156]
                  - generic [ref=e157]: "4"
                  - button "a4, empty" [disabled] [ref=e158]
                  - button "2L, b4, double letter, empty" [disabled] [ref=e159]:
                    - generic [ref=e160]: 2L
                  - button "c4, empty" [disabled] [ref=e161]
                  - button "2W, d4, double word, empty" [disabled] [ref=e162]:
                    - generic [ref=e163]: 2W
                  - button "e4, empty" [disabled] [ref=e164]
                  - button "f4, empty" [disabled] [ref=e165]
                  - button "g4, empty" [disabled] [ref=e166]
                  - button "h4, empty" [disabled] [ref=e167]
                  - button "i4, empty" [disabled] [ref=e168]
                  - button "j4, empty" [disabled] [ref=e169]
                  - button "k4, empty" [disabled] [ref=e170]
                  - button "2W, l4, double word, empty" [disabled] [ref=e171]:
                    - generic [ref=e172]: 2W
                  - button "m4, empty" [disabled] [ref=e173]
                  - button "2L, n4, double letter, empty" [disabled] [ref=e174]:
                    - generic [ref=e175]: 2L
                  - button "o4, empty" [disabled] [ref=e176]
                  - generic [ref=e177]: "5"
                  - button "3W, a5, triple word, empty" [disabled] [ref=e178]:
                    - generic [ref=e179]: 3W
                  - button "b5, empty" [disabled] [ref=e180]
                  - button "3L, c5, triple letter, empty" [disabled] [ref=e181]:
                    - generic [ref=e182]: 3L
                  - button "d5, empty" [disabled] [ref=e183]
                  - button "e5, empty" [disabled] [ref=e184]
                  - button "f5, empty" [disabled] [ref=e185]
                  - button "2L, g5, double letter, empty" [disabled] [ref=e186]:
                    - generic [ref=e187]: 2L
                  - button "h5, empty" [disabled] [ref=e188]
                  - button "2L, i5, double letter, empty" [disabled] [ref=e189]:
                    - generic [ref=e190]: 2L
                  - button "j5, empty" [disabled] [ref=e191]
                  - button "k5, empty" [disabled] [ref=e192]
                  - button "l5, empty" [disabled] [ref=e193]
                  - button "3L, m5, triple letter, empty" [disabled] [ref=e194]:
                    - generic [ref=e195]: 3L
                  - button "n5, empty" [disabled] [ref=e196]
                  - button "3W, o5, triple word, empty" [disabled] [ref=e197]:
                    - generic [ref=e198]: 3W
                  - generic [ref=e199]: "6"
                  - button "a6, empty" [disabled] [ref=e200]
                  - button "b6, empty" [disabled] [ref=e201]
                  - button "c6, empty" [disabled] [ref=e202]
                  - button "d6, empty" [disabled] [ref=e203]
                  - button "e6, empty" [disabled] [ref=e204]
                  - button "f6, empty" [disabled] [ref=e205]
                  - button "g6, empty" [disabled] [ref=e206]
                  - button "3L, h6, triple letter, empty" [disabled] [ref=e207]:
                    - generic [ref=e208]: 3L
                  - button "i6, empty" [disabled] [ref=e209]
                  - button "j6, empty" [disabled] [ref=e210]
                  - button "k6, empty" [disabled] [ref=e211]
                  - button "l6, empty" [disabled] [ref=e212]
                  - button "m6, empty" [disabled] [ref=e213]
                  - button "n6, empty" [disabled] [ref=e214]
                  - button "o6, empty" [disabled] [ref=e215]
                  - generic [ref=e216]: "7"
                  - button "a7, empty" [disabled] [ref=e217]
                  - button "2W, b7, double word, empty" [disabled] [ref=e218]:
                    - generic [ref=e219]: 2W
                  - button "c7, empty" [disabled] [ref=e220]
                  - button "d7, empty" [disabled] [ref=e221]
                  - button "2L, e7, double letter, empty" [disabled] [ref=e222]:
                    - generic [ref=e223]: 2L
                  - button "f7, empty" [disabled] [ref=e224]
                  - button "2L, g7, double letter, empty" [disabled] [ref=e225]:
                    - generic [ref=e226]: 2L
                  - button "h7, empty" [disabled] [ref=e227]
                  - button "2L, i7, double letter, empty" [disabled] [ref=e228]:
                    - generic [ref=e229]: 2L
                  - button "j7, empty" [disabled] [ref=e230]
                  - button "2L, k7, double letter, empty" [disabled] [ref=e231]:
                    - generic [ref=e232]: 2L
                  - button "l7, empty" [disabled] [ref=e233]
                  - button "m7, empty" [disabled] [ref=e234]
                  - button "2W, n7, double word, empty" [disabled] [ref=e235]:
                    - generic [ref=e236]: 2W
                  - button "o7, empty" [disabled] [ref=e237]
                  - generic [ref=e238]: "8"
                  - button "2L, a8, double letter, empty" [disabled] [ref=e239]:
                    - generic [ref=e240]: 2L
                  - button "b8, empty" [disabled] [ref=e241]
                  - button "c8, empty" [disabled] [ref=e242]
                  - button "d8, empty" [disabled] [ref=e243]
                  - button "e8, empty" [disabled] [ref=e244]
                  - button "3L, f8, triple letter, empty" [disabled] [ref=e245]:
                    - generic [ref=e246]: 3L
                  - button "C 3, g8, committed" [disabled] [ref=e247]:
                    - generic [ref=e248]: C
                    - generic [ref=e249]: "3"
                  - button "A 1, h8, committed" [disabled] [ref=e250]:
                    - generic [ref=e251]: A
                    - generic [ref=e252]: "1"
                  - button "T 1, i8, committed" [disabled] [ref=e253]:
                    - generic [ref=e254]: T
                    - generic [ref=e255]: "1"
                  - button "3L, j8, triple letter, empty" [disabled] [ref=e256]:
                    - generic [ref=e257]: 3L
                  - button "k8, empty" [disabled] [ref=e258]
                  - button "l8, empty" [disabled] [ref=e259]
                  - button "m8, empty" [disabled] [ref=e260]
                  - button "n8, empty" [disabled] [ref=e261]
                  - button "2L, o8, double letter, empty" [disabled] [ref=e262]:
                    - generic [ref=e263]: 2L
                  - generic [ref=e264]: "9"
                  - button "a9, empty" [disabled] [ref=e265]
                  - button "2W, b9, double word, empty" [disabled] [ref=e266]:
                    - generic [ref=e267]: 2W
                  - button "c9, empty" [disabled] [ref=e268]
                  - button "d9, empty" [disabled] [ref=e269]
                  - button "2L, e9, double letter, empty" [disabled] [ref=e270]:
                    - generic [ref=e271]: 2L
                  - button "f9, empty" [disabled] [ref=e272]
                  - button "2L, g9, double letter, empty" [disabled] [ref=e273]:
                    - generic [ref=e274]: 2L
                  - button "h9, empty" [disabled] [ref=e275]
                  - button "O 1, i9, committed" [disabled] [ref=e276]:
                    - generic [ref=e277]: O
                    - generic [ref=e278]: "1"
                  - button "j9, empty" [disabled] [ref=e279]
                  - button "2L, k9, double letter, empty" [disabled] [ref=e280]:
                    - generic [ref=e281]: 2L
                  - button "l9, empty" [disabled] [ref=e282]
                  - button "m9, empty" [disabled] [ref=e283]
                  - button "2W, n9, double word, empty" [disabled] [ref=e284]:
                    - generic [ref=e285]: 2W
                  - button "o9, empty" [disabled] [ref=e286]
                  - generic [ref=e287]: "10"
                  - button "a10, empty" [disabled] [ref=e288]
                  - button "b10, empty" [disabled] [ref=e289]
                  - button "c10, empty" [disabled] [ref=e290]
                  - button "d10, empty" [disabled] [ref=e291]
                  - button "e10, empty" [disabled] [ref=e292]
                  - button "f10, empty" [disabled] [ref=e293]
                  - button "g10, empty" [disabled] [ref=e294]
                  - button "3L, h10, triple letter, empty" [disabled] [ref=e295]:
                    - generic [ref=e296]: 3L
                  - button "E 1, i10, committed" [disabled] [ref=e297]:
                    - generic [ref=e298]: E
                    - generic [ref=e299]: "1"
                  - button "j10, empty" [disabled] [ref=e300]
                  - button "k10, empty" [disabled] [ref=e301]
                  - button "l10, empty" [disabled] [ref=e302]
                  - button "m10, empty" [disabled] [ref=e303]
                  - button "n10, empty" [disabled] [ref=e304]
                  - button "o10, empty" [disabled] [ref=e305]
                  - generic [ref=e306]: "11"
                  - button "3W, a11, triple word, empty" [disabled] [ref=e307]:
                    - generic [ref=e308]: 3W
                  - button "b11, empty" [disabled] [ref=e309]
                  - button "3L, c11, triple letter, empty" [disabled] [ref=e310]:
                    - generic [ref=e311]: 3L
                  - button "d11, empty" [disabled] [ref=e312]
                  - button "e11, empty" [disabled] [ref=e313]
                  - button "f11, empty" [disabled] [ref=e314]
                  - button "2L, g11, double letter, empty" [disabled] [ref=e315]:
                    - generic [ref=e316]: 2L
                  - button "h11, empty" [disabled] [ref=e317]
                  - button "2L, i11, double letter, empty" [disabled] [ref=e318]:
                    - generic [ref=e319]: 2L
                  - button "j11, empty" [disabled] [ref=e320]
                  - button "k11, empty" [disabled] [ref=e321]
                  - button "l11, empty" [disabled] [ref=e322]
                  - button "3L, m11, triple letter, empty" [disabled] [ref=e323]:
                    - generic [ref=e324]: 3L
                  - button "n11, empty" [disabled] [ref=e325]
                  - button "3W, o11, triple word, empty" [disabled] [ref=e326]:
                    - generic [ref=e327]: 3W
                  - generic [ref=e328]: "12"
                  - button "a12, empty" [disabled] [ref=e329]
                  - button "2L, b12, double letter, empty" [disabled] [ref=e330]:
                    - generic [ref=e331]: 2L
                  - button "c12, empty" [disabled] [ref=e332]
                  - button "2W, d12, double word, empty" [disabled] [ref=e333]:
                    - generic [ref=e334]: 2W
                  - button "e12, empty" [disabled] [ref=e335]
                  - button "f12, empty" [disabled] [ref=e336]
                  - button "g12, empty" [disabled] [ref=e337]
                  - button "h12, empty" [disabled] [ref=e338]
                  - button "i12, empty" [disabled] [ref=e339]
                  - button "j12, empty" [disabled] [ref=e340]
                  - button "k12, empty" [disabled] [ref=e341]
                  - button "2W, l12, double word, empty" [disabled] [ref=e342]:
                    - generic [ref=e343]: 2W
                  - button "m12, empty" [disabled] [ref=e344]
                  - button "2L, n12, double letter, empty" [disabled] [ref=e345]:
                    - generic [ref=e346]: 2L
                  - button "o12, empty" [disabled] [ref=e347]
                  - generic [ref=e348]: "13"
                  - button "a13, empty" [disabled] [ref=e349]
                  - button "b13, empty" [disabled] [ref=e350]
                  - button "c13, empty" [disabled] [ref=e351]
                  - button "d13, empty" [disabled] [ref=e352]
                  - button "3L, e13, triple letter, empty" [disabled] [ref=e353]:
                    - generic [ref=e354]: 3L
                  - button "f13, empty" [disabled] [ref=e355]
                  - button "g13, empty" [disabled] [ref=e356]
                  - button "h13, empty" [disabled] [ref=e357]
                  - button "i13, empty" [disabled] [ref=e358]
                  - button "j13, empty" [disabled] [ref=e359]
                  - button "3L, k13, triple letter, empty" [disabled] [ref=e360]:
                    - generic [ref=e361]: 3L
                  - button "l13, empty" [disabled] [ref=e362]
                  - button "m13, empty" [disabled] [ref=e363]
                  - button "n13, empty" [disabled] [ref=e364]
                  - button "o13, empty" [disabled] [ref=e365]
                  - generic [ref=e366]: "14"
                  - button "a14, empty" [disabled] [ref=e367]
                  - button "b14, empty" [disabled] [ref=e368]
                  - button "c14, empty" [disabled] [ref=e369]
                  - button "2L, d14, double letter, empty" [disabled] [ref=e370]:
                    - generic [ref=e371]: 2L
                  - button "e14, empty" [disabled] [ref=e372]
                  - button "f14, empty" [disabled] [ref=e373]
                  - button "2W, g14, double word, empty" [disabled] [ref=e374]:
                    - generic [ref=e375]: 2W
                  - button "h14, empty" [disabled] [ref=e376]
                  - button "2W, i14, double word, empty" [disabled] [ref=e377]:
                    - generic [ref=e378]: 2W
                  - button "j14, empty" [disabled] [ref=e379]
                  - button "k14, empty" [disabled] [ref=e380]
                  - button "2L, l14, double letter, empty" [disabled] [ref=e381]:
                    - generic [ref=e382]: 2L
                  - button "m14, empty" [disabled] [ref=e383]
                  - button "n14, empty" [disabled] [ref=e384]
                  - button "o14, empty" [disabled] [ref=e385]
                  - generic [ref=e386]: "15"
                  - button "2L, a15, double letter, empty" [disabled] [ref=e387]:
                    - generic [ref=e388]: 2L
                  - button "b15, empty" [disabled] [ref=e389]
                  - button "c15, empty" [disabled] [ref=e390]
                  - button "d15, empty" [disabled] [ref=e391]
                  - button "3W, e15, triple word, empty" [disabled] [ref=e392]:
                    - generic [ref=e393]: 3W
                  - button "f15, empty" [disabled] [ref=e394]
                  - button "g15, empty" [disabled] [ref=e395]
                  - button "2L, h15, double letter, empty" [disabled] [ref=e396]:
                    - generic [ref=e397]: 2L
                  - button "i15, empty" [disabled] [ref=e398]
                  - button "j15, empty" [disabled] [ref=e399]
                  - button "3W, k15, triple word, empty" [disabled] [ref=e400]:
                    - generic [ref=e401]: 3W
                  - button "l15, empty" [disabled] [ref=e402]
                  - button "m15, empty" [disabled] [ref=e403]
                  - button "n15, empty" [disabled] [ref=e404]
                  - button "2L, o15, double letter, empty" [disabled] [ref=e405]:
                    - generic [ref=e406]: 2L
          - status [ref=e408]:
            - generic [ref=e409]:
              - generic [ref=e410]: "Amber: avery. Teal: jordan_plays. Violet: morgan. Coral: robin_42."
              - text: Violet — to play · 67 tiles in the bag
          - generic [ref=e413]:
            - generic [ref=e417]:
              - generic [ref=e418]:
                - img "Amber" [ref=e419]
                - generic "avery" [ref=e422]
              - generic [ref=e425]: 7 tiles
            - generic [ref=e426]:
              - generic [ref=e427]: Score
              - generic [ref=e428]: "10"
        - region "Game record" [ref=e431]:
          - generic [ref=e432]:
            - heading "Game record" [level=2] [ref=e434]
            - paragraph [ref=e435]: Violet — to play · 67 tiles in the bag
          - button "History and stats" [ref=e438] [cursor=pointer]:
            - paragraph [ref=e441]: History and stats
      - generic [ref=e442]:
        - img [ref=e445]
        - generic [ref=e448]:
          - paragraph [ref=e449]: You're watching
          - paragraph [ref=e450]: Moves appear as they are played.
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