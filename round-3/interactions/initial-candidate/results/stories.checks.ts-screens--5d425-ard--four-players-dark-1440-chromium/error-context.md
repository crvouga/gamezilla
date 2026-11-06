# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--four-players dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  46341 pixels (ratio 0.04 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/four-players-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/four-players-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 46341 pixels (ratio 0.04 of all image pixels) are different.
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
  - 46341 pixels (ratio 0.04 of all image pixels) are different.

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
          - list "Other players" [ref=e28]:
            - listitem [ref=e29]:
              - generic [ref=e33]:
                - generic [ref=e34]: jordan_plays
                - generic [ref=e35]:
                  - generic [ref=e37]: Score 3
                  - generic [ref=e39]: 7 tiles
            - listitem [ref=e40]:
              - generic [ref=e44]:
                - generic [ref=e45]: morgan
                - generic [ref=e46]:
                  - generic [ref=e48]: Score 0
                  - generic [ref=e50]: 7 tiles
            - listitem [ref=e51]:
              - generic [ref=e55]:
                - generic [ref=e56]: robin_42
                - generic [ref=e57]:
                  - generic [ref=e59]: Score 0
                  - generic [ref=e61]: 7 tiles
          - generic [ref=e63]:
            - paragraph [ref=e64]: You are watching. Racks stay private to their players.
            - generic [ref=e65]:
              - generic [ref=e66]:
                - button "Fit board" [pressed] [ref=e67] [cursor=pointer]:
                  - paragraph [ref=e70]: Fit board
                - button "Enlarge board" [ref=e71] [cursor=pointer]:
                  - paragraph [ref=e74]: Enlarge board
              - region "Scrollable word board" [ref=e75]:
                - group "Word board, fifteen columns and fifteen rows" [ref=e76]:
                  - generic [ref=e78]: a
                  - generic [ref=e79]: b
                  - generic [ref=e80]: c
                  - generic [ref=e81]: d
                  - generic [ref=e82]: e
                  - generic [ref=e83]: f
                  - generic [ref=e84]: g
                  - generic [ref=e85]: h
                  - generic [ref=e86]: i
                  - generic [ref=e87]: j
                  - generic [ref=e88]: k
                  - generic [ref=e89]: l
                  - generic [ref=e90]: m
                  - generic [ref=e91]: "n"
                  - generic [ref=e92]: o
                  - generic [ref=e93]: "1"
                  - button "2L, a1, double letter, empty" [disabled] [ref=e94]:
                    - generic [ref=e95]: 2L
                  - button "b1, empty" [disabled] [ref=e96]
                  - button "c1, empty" [disabled] [ref=e97]
                  - button "d1, empty" [disabled] [ref=e98]
                  - button "3W, e1, triple word, empty" [disabled] [ref=e99]:
                    - generic [ref=e100]: 3W
                  - button "f1, empty" [disabled] [ref=e101]
                  - button "g1, empty" [disabled] [ref=e102]
                  - button "2L, h1, double letter, empty" [disabled] [ref=e103]:
                    - generic [ref=e104]: 2L
                  - button "i1, empty" [disabled] [ref=e105]
                  - button "j1, empty" [disabled] [ref=e106]
                  - button "3W, k1, triple word, empty" [disabled] [ref=e107]:
                    - generic [ref=e108]: 3W
                  - button "l1, empty" [disabled] [ref=e109]
                  - button "m1, empty" [disabled] [ref=e110]
                  - button "n1, empty" [disabled] [ref=e111]
                  - button "2L, o1, double letter, empty" [disabled] [ref=e112]:
                    - generic [ref=e113]: 2L
                  - generic [ref=e114]: "2"
                  - button "a2, empty" [disabled] [ref=e115]
                  - button "b2, empty" [disabled] [ref=e116]
                  - button "c2, empty" [disabled] [ref=e117]
                  - button "2L, d2, double letter, empty" [disabled] [ref=e118]:
                    - generic [ref=e119]: 2L
                  - button "e2, empty" [disabled] [ref=e120]
                  - button "f2, empty" [disabled] [ref=e121]
                  - button "2W, g2, double word, empty" [disabled] [ref=e122]:
                    - generic [ref=e123]: 2W
                  - button "h2, empty" [disabled] [ref=e124]
                  - button "2W, i2, double word, empty" [disabled] [ref=e125]:
                    - generic [ref=e126]: 2W
                  - button "j2, empty" [disabled] [ref=e127]
                  - button "k2, empty" [disabled] [ref=e128]
                  - button "2L, l2, double letter, empty" [disabled] [ref=e129]:
                    - generic [ref=e130]: 2L
                  - button "m2, empty" [disabled] [ref=e131]
                  - button "n2, empty" [disabled] [ref=e132]
                  - button "o2, empty" [disabled] [ref=e133]
                  - generic [ref=e134]: "3"
                  - button "a3, empty" [disabled] [ref=e135]
                  - button "b3, empty" [disabled] [ref=e136]
                  - button "c3, empty" [disabled] [ref=e137]
                  - button "d3, empty" [disabled] [ref=e138]
                  - button "3L, e3, triple letter, empty" [disabled] [ref=e139]:
                    - generic [ref=e140]: 3L
                  - button "f3, empty" [disabled] [ref=e141]
                  - button "g3, empty" [disabled] [ref=e142]
                  - button "h3, empty" [disabled] [ref=e143]
                  - button "i3, empty" [disabled] [ref=e144]
                  - button "j3, empty" [disabled] [ref=e145]
                  - button "3L, k3, triple letter, empty" [disabled] [ref=e146]:
                    - generic [ref=e147]: 3L
                  - button "l3, empty" [disabled] [ref=e148]
                  - button "m3, empty" [disabled] [ref=e149]
                  - button "n3, empty" [disabled] [ref=e150]
                  - button "o3, empty" [disabled] [ref=e151]
                  - generic [ref=e152]: "4"
                  - button "a4, empty" [disabled] [ref=e153]
                  - button "2L, b4, double letter, empty" [disabled] [ref=e154]:
                    - generic [ref=e155]: 2L
                  - button "c4, empty" [disabled] [ref=e156]
                  - button "2W, d4, double word, empty" [disabled] [ref=e157]:
                    - generic [ref=e158]: 2W
                  - button "e4, empty" [disabled] [ref=e159]
                  - button "f4, empty" [disabled] [ref=e160]
                  - button "g4, empty" [disabled] [ref=e161]
                  - button "h4, empty" [disabled] [ref=e162]
                  - button "i4, empty" [disabled] [ref=e163]
                  - button "j4, empty" [disabled] [ref=e164]
                  - button "k4, empty" [disabled] [ref=e165]
                  - button "2W, l4, double word, empty" [disabled] [ref=e166]:
                    - generic [ref=e167]: 2W
                  - button "m4, empty" [disabled] [ref=e168]
                  - button "2L, n4, double letter, empty" [disabled] [ref=e169]:
                    - generic [ref=e170]: 2L
                  - button "o4, empty" [disabled] [ref=e171]
                  - generic [ref=e172]: "5"
                  - button "3W, a5, triple word, empty" [disabled] [ref=e173]:
                    - generic [ref=e174]: 3W
                  - button "b5, empty" [disabled] [ref=e175]
                  - button "3L, c5, triple letter, empty" [disabled] [ref=e176]:
                    - generic [ref=e177]: 3L
                  - button "d5, empty" [disabled] [ref=e178]
                  - button "e5, empty" [disabled] [ref=e179]
                  - button "f5, empty" [disabled] [ref=e180]
                  - button "2L, g5, double letter, empty" [disabled] [ref=e181]:
                    - generic [ref=e182]: 2L
                  - button "h5, empty" [disabled] [ref=e183]
                  - button "2L, i5, double letter, empty" [disabled] [ref=e184]:
                    - generic [ref=e185]: 2L
                  - button "j5, empty" [disabled] [ref=e186]
                  - button "k5, empty" [disabled] [ref=e187]
                  - button "l5, empty" [disabled] [ref=e188]
                  - button "3L, m5, triple letter, empty" [disabled] [ref=e189]:
                    - generic [ref=e190]: 3L
                  - button "n5, empty" [disabled] [ref=e191]
                  - button "3W, o5, triple word, empty" [disabled] [ref=e192]:
                    - generic [ref=e193]: 3W
                  - generic [ref=e194]: "6"
                  - button "a6, empty" [disabled] [ref=e195]
                  - button "b6, empty" [disabled] [ref=e196]
                  - button "c6, empty" [disabled] [ref=e197]
                  - button "d6, empty" [disabled] [ref=e198]
                  - button "e6, empty" [disabled] [ref=e199]
                  - button "f6, empty" [disabled] [ref=e200]
                  - button "g6, empty" [disabled] [ref=e201]
                  - button "3L, h6, triple letter, empty" [disabled] [ref=e202]:
                    - generic [ref=e203]: 3L
                  - button "i6, empty" [disabled] [ref=e204]
                  - button "j6, empty" [disabled] [ref=e205]
                  - button "k6, empty" [disabled] [ref=e206]
                  - button "l6, empty" [disabled] [ref=e207]
                  - button "m6, empty" [disabled] [ref=e208]
                  - button "n6, empty" [disabled] [ref=e209]
                  - button "o6, empty" [disabled] [ref=e210]
                  - generic [ref=e211]: "7"
                  - button "a7, empty" [disabled] [ref=e212]
                  - button "2W, b7, double word, empty" [disabled] [ref=e213]:
                    - generic [ref=e214]: 2W
                  - button "c7, empty" [disabled] [ref=e215]
                  - button "d7, empty" [disabled] [ref=e216]
                  - button "2L, e7, double letter, empty" [disabled] [ref=e217]:
                    - generic [ref=e218]: 2L
                  - button "f7, empty" [disabled] [ref=e219]
                  - button "2L, g7, double letter, empty" [disabled] [ref=e220]:
                    - generic [ref=e221]: 2L
                  - button "h7, empty" [disabled] [ref=e222]
                  - button "2L, i7, double letter, empty" [disabled] [ref=e223]:
                    - generic [ref=e224]: 2L
                  - button "j7, empty" [disabled] [ref=e225]
                  - button "2L, k7, double letter, empty" [disabled] [ref=e226]:
                    - generic [ref=e227]: 2L
                  - button "l7, empty" [disabled] [ref=e228]
                  - button "m7, empty" [disabled] [ref=e229]
                  - button "2W, n7, double word, empty" [disabled] [ref=e230]:
                    - generic [ref=e231]: 2W
                  - button "o7, empty" [disabled] [ref=e232]
                  - generic [ref=e233]: "8"
                  - button "2L, a8, double letter, empty" [disabled] [ref=e234]:
                    - generic [ref=e235]: 2L
                  - button "b8, empty" [disabled] [ref=e236]
                  - button "c8, empty" [disabled] [ref=e237]
                  - button "d8, empty" [disabled] [ref=e238]
                  - button "e8, empty" [disabled] [ref=e239]
                  - button "3L, f8, triple letter, empty" [disabled] [ref=e240]:
                    - generic [ref=e241]: 3L
                  - button "C 3, g8, committed" [disabled] [ref=e242]:
                    - generic [ref=e243]: C
                    - generic [ref=e244]: "3"
                  - button "A 1, h8, committed" [disabled] [ref=e245]:
                    - generic [ref=e246]: A
                    - generic [ref=e247]: "1"
                  - button "T 1, i8, committed" [disabled] [ref=e248]:
                    - generic [ref=e249]: T
                    - generic [ref=e250]: "1"
                  - button "3L, j8, triple letter, empty" [disabled] [ref=e251]:
                    - generic [ref=e252]: 3L
                  - button "k8, empty" [disabled] [ref=e253]
                  - button "l8, empty" [disabled] [ref=e254]
                  - button "m8, empty" [disabled] [ref=e255]
                  - button "n8, empty" [disabled] [ref=e256]
                  - button "2L, o8, double letter, empty" [disabled] [ref=e257]:
                    - generic [ref=e258]: 2L
                  - generic [ref=e259]: "9"
                  - button "a9, empty" [disabled] [ref=e260]
                  - button "2W, b9, double word, empty" [disabled] [ref=e261]:
                    - generic [ref=e262]: 2W
                  - button "c9, empty" [disabled] [ref=e263]
                  - button "d9, empty" [disabled] [ref=e264]
                  - button "2L, e9, double letter, empty" [disabled] [ref=e265]:
                    - generic [ref=e266]: 2L
                  - button "f9, empty" [disabled] [ref=e267]
                  - button "2L, g9, double letter, empty" [disabled] [ref=e268]:
                    - generic [ref=e269]: 2L
                  - button "h9, empty" [disabled] [ref=e270]
                  - button "O 1, i9, committed" [disabled] [ref=e271]:
                    - generic [ref=e272]: O
                    - generic [ref=e273]: "1"
                  - button "j9, empty" [disabled] [ref=e274]
                  - button "2L, k9, double letter, empty" [disabled] [ref=e275]:
                    - generic [ref=e276]: 2L
                  - button "l9, empty" [disabled] [ref=e277]
                  - button "m9, empty" [disabled] [ref=e278]
                  - button "2W, n9, double word, empty" [disabled] [ref=e279]:
                    - generic [ref=e280]: 2W
                  - button "o9, empty" [disabled] [ref=e281]
                  - generic [ref=e282]: "10"
                  - button "a10, empty" [disabled] [ref=e283]
                  - button "b10, empty" [disabled] [ref=e284]
                  - button "c10, empty" [disabled] [ref=e285]
                  - button "d10, empty" [disabled] [ref=e286]
                  - button "e10, empty" [disabled] [ref=e287]
                  - button "f10, empty" [disabled] [ref=e288]
                  - button "g10, empty" [disabled] [ref=e289]
                  - button "3L, h10, triple letter, empty" [disabled] [ref=e290]:
                    - generic [ref=e291]: 3L
                  - button "E 1, i10, committed" [disabled] [ref=e292]:
                    - generic [ref=e293]: E
                    - generic [ref=e294]: "1"
                  - button "j10, empty" [disabled] [ref=e295]
                  - button "k10, empty" [disabled] [ref=e296]
                  - button "l10, empty" [disabled] [ref=e297]
                  - button "m10, empty" [disabled] [ref=e298]
                  - button "n10, empty" [disabled] [ref=e299]
                  - button "o10, empty" [disabled] [ref=e300]
                  - generic [ref=e301]: "11"
                  - button "3W, a11, triple word, empty" [disabled] [ref=e302]:
                    - generic [ref=e303]: 3W
                  - button "b11, empty" [disabled] [ref=e304]
                  - button "3L, c11, triple letter, empty" [disabled] [ref=e305]:
                    - generic [ref=e306]: 3L
                  - button "d11, empty" [disabled] [ref=e307]
                  - button "e11, empty" [disabled] [ref=e308]
                  - button "f11, empty" [disabled] [ref=e309]
                  - button "2L, g11, double letter, empty" [disabled] [ref=e310]:
                    - generic [ref=e311]: 2L
                  - button "h11, empty" [disabled] [ref=e312]
                  - button "2L, i11, double letter, empty" [disabled] [ref=e313]:
                    - generic [ref=e314]: 2L
                  - button "j11, empty" [disabled] [ref=e315]
                  - button "k11, empty" [disabled] [ref=e316]
                  - button "l11, empty" [disabled] [ref=e317]
                  - button "3L, m11, triple letter, empty" [disabled] [ref=e318]:
                    - generic [ref=e319]: 3L
                  - button "n11, empty" [disabled] [ref=e320]
                  - button "3W, o11, triple word, empty" [disabled] [ref=e321]:
                    - generic [ref=e322]: 3W
                  - generic [ref=e323]: "12"
                  - button "a12, empty" [disabled] [ref=e324]
                  - button "2L, b12, double letter, empty" [disabled] [ref=e325]:
                    - generic [ref=e326]: 2L
                  - button "c12, empty" [disabled] [ref=e327]
                  - button "2W, d12, double word, empty" [disabled] [ref=e328]:
                    - generic [ref=e329]: 2W
                  - button "e12, empty" [disabled] [ref=e330]
                  - button "f12, empty" [disabled] [ref=e331]
                  - button "g12, empty" [disabled] [ref=e332]
                  - button "h12, empty" [disabled] [ref=e333]
                  - button "i12, empty" [disabled] [ref=e334]
                  - button "j12, empty" [disabled] [ref=e335]
                  - button "k12, empty" [disabled] [ref=e336]
                  - button "2W, l12, double word, empty" [disabled] [ref=e337]:
                    - generic [ref=e338]: 2W
                  - button "m12, empty" [disabled] [ref=e339]
                  - button "2L, n12, double letter, empty" [disabled] [ref=e340]:
                    - generic [ref=e341]: 2L
                  - button "o12, empty" [disabled] [ref=e342]
                  - generic [ref=e343]: "13"
                  - button "a13, empty" [disabled] [ref=e344]
                  - button "b13, empty" [disabled] [ref=e345]
                  - button "c13, empty" [disabled] [ref=e346]
                  - button "d13, empty" [disabled] [ref=e347]
                  - button "3L, e13, triple letter, empty" [disabled] [ref=e348]:
                    - generic [ref=e349]: 3L
                  - button "f13, empty" [disabled] [ref=e350]
                  - button "g13, empty" [disabled] [ref=e351]
                  - button "h13, empty" [disabled] [ref=e352]
                  - button "i13, empty" [disabled] [ref=e353]
                  - button "j13, empty" [disabled] [ref=e354]
                  - button "3L, k13, triple letter, empty" [disabled] [ref=e355]:
                    - generic [ref=e356]: 3L
                  - button "l13, empty" [disabled] [ref=e357]
                  - button "m13, empty" [disabled] [ref=e358]
                  - button "n13, empty" [disabled] [ref=e359]
                  - button "o13, empty" [disabled] [ref=e360]
                  - generic [ref=e361]: "14"
                  - button "a14, empty" [disabled] [ref=e362]
                  - button "b14, empty" [disabled] [ref=e363]
                  - button "c14, empty" [disabled] [ref=e364]
                  - button "2L, d14, double letter, empty" [disabled] [ref=e365]:
                    - generic [ref=e366]: 2L
                  - button "e14, empty" [disabled] [ref=e367]
                  - button "f14, empty" [disabled] [ref=e368]
                  - button "2W, g14, double word, empty" [disabled] [ref=e369]:
                    - generic [ref=e370]: 2W
                  - button "h14, empty" [disabled] [ref=e371]
                  - button "2W, i14, double word, empty" [disabled] [ref=e372]:
                    - generic [ref=e373]: 2W
                  - button "j14, empty" [disabled] [ref=e374]
                  - button "k14, empty" [disabled] [ref=e375]
                  - button "2L, l14, double letter, empty" [disabled] [ref=e376]:
                    - generic [ref=e377]: 2L
                  - button "m14, empty" [disabled] [ref=e378]
                  - button "n14, empty" [disabled] [ref=e379]
                  - button "o14, empty" [disabled] [ref=e380]
                  - generic [ref=e381]: "15"
                  - button "2L, a15, double letter, empty" [disabled] [ref=e382]:
                    - generic [ref=e383]: 2L
                  - button "b15, empty" [disabled] [ref=e384]
                  - button "c15, empty" [disabled] [ref=e385]
                  - button "d15, empty" [disabled] [ref=e386]
                  - button "3W, e15, triple word, empty" [disabled] [ref=e387]:
                    - generic [ref=e388]: 3W
                  - button "f15, empty" [disabled] [ref=e389]
                  - button "g15, empty" [disabled] [ref=e390]
                  - button "2L, h15, double letter, empty" [disabled] [ref=e391]:
                    - generic [ref=e392]: 2L
                  - button "i15, empty" [disabled] [ref=e393]
                  - button "j15, empty" [disabled] [ref=e394]
                  - button "3W, k15, triple word, empty" [disabled] [ref=e395]:
                    - generic [ref=e396]: 3W
                  - button "l15, empty" [disabled] [ref=e397]
                  - button "m15, empty" [disabled] [ref=e398]
                  - button "n15, empty" [disabled] [ref=e399]
                  - button "2L, o15, double letter, empty" [disabled] [ref=e400]:
                    - generic [ref=e401]: 2L
          - status [ref=e403]:
            - generic [ref=e404]:
              - generic [ref=e405]: "Amber: avery. Teal: jordan_plays. Violet: morgan. Coral: robin_42."
              - text: Violet — to play · 67 tiles in the bag
          - generic [ref=e408]:
            - generic [ref=e412]:
              - generic [ref=e413]:
                - img "Amber" [ref=e414]
                - generic [ref=e415]: avery
              - generic [ref=e418]: 7 tiles
            - generic [ref=e419]:
              - generic [ref=e420]: Score
              - generic [ref=e421]: "10"
        - region "Game record" [ref=e424]:
          - generic [ref=e425]:
            - heading "Game record" [level=2] [ref=e427]
            - paragraph [ref=e428]: Violet — to play · 67 tiles in the bag
          - button "History and stats" [ref=e431] [cursor=pointer]:
            - paragraph [ref=e434]: History and stats
      - generic [ref=e435]:
        - img [ref=e438]
        - generic [ref=e441]:
          - paragraph [ref=e442]: You're watching
          - paragraph [ref=e443]: Moves appear as they are played.
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