# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--game-over light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  98317 pixels (ratio 0.30 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/game-over-light.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/game-over-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 98317 pixels (ratio 0.30 of all image pixels) are different.
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
  - 98317 pixels (ratio 0.30 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e12]:
    - generic [ref=e13]:
      - heading "Word Tiles" [level=1] [ref=e16]
      - generic [ref=e18]:
        - generic [ref=e19]: Unrated
        - generic [ref=e20]: ·Untimed
    - generic [ref=e21]:
      - generic [ref=e23]:
        - heading "You win" [level=2] [ref=e25]
        - group "What next" [ref=e26]:
          - button "Rematch" [ref=e27] [cursor=pointer]:
            - paragraph [ref=e30]: Rematch
          - button "Change game" [ref=e31] [cursor=pointer]:
            - paragraph [ref=e34]: Change game
          - button "Review" [ref=e35] [cursor=pointer]:
            - paragraph [ref=e38]: Review
      - generic [ref=e41]:
        - paragraph [ref=e46]: No moves yet.
        - button "All moves" [ref=e47] [cursor=pointer]:
          - img [ref=e51]
      - generic [ref=e53]:
        - generic [ref=e55]:
          - generic [ref=e57]:
            - generic [ref=e61]:
              - generic [ref=e62]:
                - img "Teal" [ref=e63]
                - generic "jordan_plays" [ref=e66]
              - generic [ref=e69]: 2 tiles
            - generic [ref=e70]:
              - generic [ref=e71]: Score
              - generic [ref=e72]: "154"
          - generic [ref=e74]:
            - group "Your rack" [ref=e75]
            - generic [ref=e76]:
              - generic [ref=e77]:
                - button "Fit board" [pressed] [ref=e78] [cursor=pointer]:
                  - paragraph [ref=e81]: Fit board
                - button "Enlarge board" [ref=e82] [cursor=pointer]:
                  - paragraph [ref=e85]: Enlarge board
              - region "Scrollable word board" [ref=e87]:
                - group "Word board, fifteen columns and fifteen rows" [ref=e88]:
                  - generic [ref=e90]: a
                  - generic [ref=e91]: b
                  - generic [ref=e92]: c
                  - generic [ref=e93]: d
                  - generic [ref=e94]: e
                  - generic [ref=e95]: f
                  - generic [ref=e96]: g
                  - generic [ref=e97]: h
                  - generic [ref=e98]: i
                  - generic [ref=e99]: j
                  - generic [ref=e100]: k
                  - generic [ref=e101]: l
                  - generic [ref=e102]: m
                  - generic [ref=e103]: "n"
                  - generic [ref=e104]: o
                  - generic [ref=e105]: "1"
                  - button "2L, a1, double letter, empty" [disabled] [ref=e106]:
                    - generic [ref=e107]: 2L
                  - button "b1, empty" [disabled] [ref=e108]
                  - button "c1, empty" [disabled] [ref=e109]
                  - button "d1, empty" [disabled] [ref=e110]
                  - button "3W, e1, triple word, empty" [disabled] [ref=e111]:
                    - generic [ref=e112]: 3W
                  - button "f1, empty" [disabled] [ref=e113]
                  - button "g1, empty" [disabled] [ref=e114]
                  - button "2L, h1, double letter, empty" [disabled] [ref=e115]:
                    - generic [ref=e116]: 2L
                  - button "i1, empty" [disabled] [ref=e117]
                  - button "j1, empty" [disabled] [ref=e118]
                  - button "3W, k1, triple word, empty" [disabled] [ref=e119]:
                    - generic [ref=e120]: 3W
                  - button "l1, empty" [disabled] [ref=e121]
                  - button "m1, empty" [disabled] [ref=e122]
                  - button "n1, empty" [disabled] [ref=e123]
                  - button "2L, o1, double letter, empty" [disabled] [ref=e124]:
                    - generic [ref=e125]: 2L
                  - generic [ref=e126]: "2"
                  - button "a2, empty" [disabled] [ref=e127]
                  - button "b2, empty" [disabled] [ref=e128]
                  - button "c2, empty" [disabled] [ref=e129]
                  - button "2L, d2, double letter, empty" [disabled] [ref=e130]:
                    - generic [ref=e131]: 2L
                  - button "e2, empty" [disabled] [ref=e132]
                  - button "f2, empty" [disabled] [ref=e133]
                  - button "2W, g2, double word, empty" [disabled] [ref=e134]:
                    - generic [ref=e135]: 2W
                  - button "h2, empty" [disabled] [ref=e136]
                  - button "2W, i2, double word, empty" [disabled] [ref=e137]:
                    - generic [ref=e138]: 2W
                  - button "j2, empty" [disabled] [ref=e139]
                  - button "k2, empty" [disabled] [ref=e140]
                  - button "2L, l2, double letter, empty" [disabled] [ref=e141]:
                    - generic [ref=e142]: 2L
                  - button "m2, empty" [disabled] [ref=e143]
                  - button "n2, empty" [disabled] [ref=e144]
                  - button "o2, empty" [disabled] [ref=e145]
                  - generic [ref=e146]: "3"
                  - button "a3, empty" [disabled] [ref=e147]
                  - button "b3, empty" [disabled] [ref=e148]
                  - button "c3, empty" [disabled] [ref=e149]
                  - button "d3, empty" [disabled] [ref=e150]
                  - button "3L, e3, triple letter, empty" [disabled] [ref=e151]:
                    - generic [ref=e152]: 3L
                  - button "f3, empty" [disabled] [ref=e153]
                  - button "g3, empty" [disabled] [ref=e154]
                  - button "h3, empty" [disabled] [ref=e155]
                  - button "i3, empty" [disabled] [ref=e156]
                  - button "j3, empty" [disabled] [ref=e157]
                  - button "3L, k3, triple letter, empty" [disabled] [ref=e158]:
                    - generic [ref=e159]: 3L
                  - button "l3, empty" [disabled] [ref=e160]
                  - button "m3, empty" [disabled] [ref=e161]
                  - button "n3, empty" [disabled] [ref=e162]
                  - button "o3, empty" [disabled] [ref=e163]
                  - generic [ref=e164]: "4"
                  - button "a4, empty" [disabled] [ref=e165]
                  - button "2L, b4, double letter, empty" [disabled] [ref=e166]:
                    - generic [ref=e167]: 2L
                  - button "c4, empty" [disabled] [ref=e168]
                  - button "2W, d4, double word, empty" [disabled] [ref=e169]:
                    - generic [ref=e170]: 2W
                  - button "e4, empty" [disabled] [ref=e171]
                  - button "f4, empty" [disabled] [ref=e172]
                  - button "g4, empty" [disabled] [ref=e173]
                  - button "h4, empty" [disabled] [ref=e174]
                  - button "i4, empty" [disabled] [ref=e175]
                  - button "j4, empty" [disabled] [ref=e176]
                  - button "k4, empty" [disabled] [ref=e177]
                  - button "2W, l4, double word, empty" [disabled] [ref=e178]:
                    - generic [ref=e179]: 2W
                  - button "m4, empty" [disabled] [ref=e180]
                  - button "2L, n4, double letter, empty" [disabled] [ref=e181]:
                    - generic [ref=e182]: 2L
                  - button "o4, empty" [disabled] [ref=e183]
                  - generic [ref=e184]: "5"
                  - button "3W, a5, triple word, empty" [disabled] [ref=e185]:
                    - generic [ref=e186]: 3W
                  - button "b5, empty" [disabled] [ref=e187]
                  - button "3L, c5, triple letter, empty" [disabled] [ref=e188]:
                    - generic [ref=e189]: 3L
                  - button "d5, empty" [disabled] [ref=e190]
                  - button "e5, empty" [disabled] [ref=e191]
                  - button "f5, empty" [disabled] [ref=e192]
                  - button "2L, g5, double letter, empty" [disabled] [ref=e193]:
                    - generic [ref=e194]: 2L
                  - button "h5, empty" [disabled] [ref=e195]
                  - button "2L, i5, double letter, empty" [disabled] [ref=e196]:
                    - generic [ref=e197]: 2L
                  - button "j5, empty" [disabled] [ref=e198]
                  - button "k5, empty" [disabled] [ref=e199]
                  - button "l5, empty" [disabled] [ref=e200]
                  - button "3L, m5, triple letter, empty" [disabled] [ref=e201]:
                    - generic [ref=e202]: 3L
                  - button "n5, empty" [disabled] [ref=e203]
                  - button "3W, o5, triple word, empty" [disabled] [ref=e204]:
                    - generic [ref=e205]: 3W
                  - generic [ref=e206]: "6"
                  - button "a6, empty" [disabled] [ref=e207]
                  - button "b6, empty" [disabled] [ref=e208]
                  - button "c6, empty" [disabled] [ref=e209]
                  - button "d6, empty" [disabled] [ref=e210]
                  - button "e6, empty" [disabled] [ref=e211]
                  - button "f6, empty" [disabled] [ref=e212]
                  - button "g6, empty" [disabled] [ref=e213]
                  - button "3L, h6, triple letter, empty" [disabled] [ref=e214]:
                    - generic [ref=e215]: 3L
                  - button "i6, empty" [disabled] [ref=e216]
                  - button "j6, empty" [disabled] [ref=e217]
                  - button "k6, empty" [disabled] [ref=e218]
                  - button "l6, empty" [disabled] [ref=e219]
                  - button "m6, empty" [disabled] [ref=e220]
                  - button "n6, empty" [disabled] [ref=e221]
                  - button "o6, empty" [disabled] [ref=e222]
                  - generic [ref=e223]: "7"
                  - button "a7, empty" [disabled] [ref=e224]
                  - button "2W, b7, double word, empty" [disabled] [ref=e225]:
                    - generic [ref=e226]: 2W
                  - button "c7, empty" [disabled] [ref=e227]
                  - button "d7, empty" [disabled] [ref=e228]
                  - button "2L, e7, double letter, empty" [disabled] [ref=e229]:
                    - generic [ref=e230]: 2L
                  - button "f7, empty" [disabled] [ref=e231]
                  - button "2L, g7, double letter, empty" [disabled] [ref=e232]:
                    - generic [ref=e233]: 2L
                  - button "h7, empty" [disabled] [ref=e234]
                  - button "2L, i7, double letter, empty" [disabled] [ref=e235]:
                    - generic [ref=e236]: 2L
                  - button "j7, empty" [disabled] [ref=e237]
                  - button "2L, k7, double letter, empty" [disabled] [ref=e238]:
                    - generic [ref=e239]: 2L
                  - button "l7, empty" [disabled] [ref=e240]
                  - button "m7, empty" [disabled] [ref=e241]
                  - button "2W, n7, double word, empty" [disabled] [ref=e242]:
                    - generic [ref=e243]: 2W
                  - button "o7, empty" [disabled] [ref=e244]
                  - generic [ref=e245]: "8"
                  - button "2L, a8, double letter, empty" [disabled] [ref=e246]:
                    - generic [ref=e247]: 2L
                  - button "b8, empty" [disabled] [ref=e248]
                  - button "c8, empty" [disabled] [ref=e249]
                  - button "d8, empty" [disabled] [ref=e250]
                  - button "e8, empty" [disabled] [ref=e251]
                  - button "3L, f8, triple letter, empty" [disabled] [ref=e252]:
                    - generic [ref=e253]: 3L
                  - button "C 3, g8, committed" [disabled] [ref=e254]:
                    - generic [ref=e255]: C
                  - button "A 1, h8, committed" [disabled] [ref=e256]:
                    - generic [ref=e257]: A
                  - button "T 1, i8, committed" [disabled] [ref=e258]:
                    - generic [ref=e259]: T
                  - button "3L, j8, triple letter, empty" [disabled] [ref=e260]:
                    - generic [ref=e261]: 3L
                  - button "k8, empty" [disabled] [ref=e262]
                  - button "l8, empty" [disabled] [ref=e263]
                  - button "m8, empty" [disabled] [ref=e264]
                  - button "n8, empty" [disabled] [ref=e265]
                  - button "2L, o8, double letter, empty" [disabled] [ref=e266]:
                    - generic [ref=e267]: 2L
                  - generic [ref=e268]: "9"
                  - button "a9, empty" [disabled] [ref=e269]
                  - button "2W, b9, double word, empty" [disabled] [ref=e270]:
                    - generic [ref=e271]: 2W
                  - button "c9, empty" [disabled] [ref=e272]
                  - button "d9, empty" [disabled] [ref=e273]
                  - button "2L, e9, double letter, empty" [disabled] [ref=e274]:
                    - generic [ref=e275]: 2L
                  - button "f9, empty" [disabled] [ref=e276]
                  - button "2L, g9, double letter, empty" [disabled] [ref=e277]:
                    - generic [ref=e278]: 2L
                  - button "h9, empty" [disabled] [ref=e279]
                  - button "O 1, i9, committed" [disabled] [ref=e280]:
                    - generic [ref=e281]: O
                  - button "j9, empty" [disabled] [ref=e282]
                  - button "2L, k9, double letter, empty" [disabled] [ref=e283]:
                    - generic [ref=e284]: 2L
                  - button "l9, empty" [disabled] [ref=e285]
                  - button "m9, empty" [disabled] [ref=e286]
                  - button "2W, n9, double word, empty" [disabled] [ref=e287]:
                    - generic [ref=e288]: 2W
                  - button "o9, empty" [disabled] [ref=e289]
                  - generic [ref=e290]: "10"
                  - button "a10, empty" [disabled] [ref=e291]
                  - button "b10, empty" [disabled] [ref=e292]
                  - button "c10, empty" [disabled] [ref=e293]
                  - button "d10, empty" [disabled] [ref=e294]
                  - button "e10, empty" [disabled] [ref=e295]
                  - button "f10, empty" [disabled] [ref=e296]
                  - button "g10, empty" [disabled] [ref=e297]
                  - button "3L, h10, triple letter, empty" [disabled] [ref=e298]:
                    - generic [ref=e299]: 3L
                  - button "E 1, i10, committed" [disabled] [ref=e300]:
                    - generic [ref=e301]: E
                  - button "j10, empty" [disabled] [ref=e302]
                  - button "k10, empty" [disabled] [ref=e303]
                  - button "l10, empty" [disabled] [ref=e304]
                  - button "m10, empty" [disabled] [ref=e305]
                  - button "n10, empty" [disabled] [ref=e306]
                  - button "o10, empty" [disabled] [ref=e307]
                  - generic [ref=e308]: "11"
                  - button "3W, a11, triple word, empty" [disabled] [ref=e309]:
                    - generic [ref=e310]: 3W
                  - button "b11, empty" [disabled] [ref=e311]
                  - button "3L, c11, triple letter, empty" [disabled] [ref=e312]:
                    - generic [ref=e313]: 3L
                  - button "d11, empty" [disabled] [ref=e314]
                  - button "e11, empty" [disabled] [ref=e315]
                  - button "f11, empty" [disabled] [ref=e316]
                  - button "2L, g11, double letter, empty" [disabled] [ref=e317]:
                    - generic [ref=e318]: 2L
                  - button "h11, empty" [disabled] [ref=e319]
                  - button "2L, i11, double letter, empty" [disabled] [ref=e320]:
                    - generic [ref=e321]: 2L
                  - button "j11, empty" [disabled] [ref=e322]
                  - button "k11, empty" [disabled] [ref=e323]
                  - button "l11, empty" [disabled] [ref=e324]
                  - button "3L, m11, triple letter, empty" [disabled] [ref=e325]:
                    - generic [ref=e326]: 3L
                  - button "n11, empty" [disabled] [ref=e327]
                  - button "3W, o11, triple word, empty" [disabled] [ref=e328]:
                    - generic [ref=e329]: 3W
                  - generic [ref=e330]: "12"
                  - button "a12, empty" [disabled] [ref=e331]
                  - button "2L, b12, double letter, empty" [disabled] [ref=e332]:
                    - generic [ref=e333]: 2L
                  - button "c12, empty" [disabled] [ref=e334]
                  - button "2W, d12, double word, empty" [disabled] [ref=e335]:
                    - generic [ref=e336]: 2W
                  - button "e12, empty" [disabled] [ref=e337]
                  - button "f12, empty" [disabled] [ref=e338]
                  - button "g12, empty" [disabled] [ref=e339]
                  - button "h12, empty" [disabled] [ref=e340]
                  - button "i12, empty" [disabled] [ref=e341]
                  - button "j12, empty" [disabled] [ref=e342]
                  - button "k12, empty" [disabled] [ref=e343]
                  - button "2W, l12, double word, empty" [disabled] [ref=e344]:
                    - generic [ref=e345]: 2W
                  - button "m12, empty" [disabled] [ref=e346]
                  - button "2L, n12, double letter, empty" [disabled] [ref=e347]:
                    - generic [ref=e348]: 2L
                  - button "o12, empty" [disabled] [ref=e349]
                  - generic [ref=e350]: "13"
                  - button "a13, empty" [disabled] [ref=e351]
                  - button "b13, empty" [disabled] [ref=e352]
                  - button "c13, empty" [disabled] [ref=e353]
                  - button "d13, empty" [disabled] [ref=e354]
                  - button "3L, e13, triple letter, empty" [disabled] [ref=e355]:
                    - generic [ref=e356]: 3L
                  - button "f13, empty" [disabled] [ref=e357]
                  - button "g13, empty" [disabled] [ref=e358]
                  - button "h13, empty" [disabled] [ref=e359]
                  - button "i13, empty" [disabled] [ref=e360]
                  - button "j13, empty" [disabled] [ref=e361]
                  - button "3L, k13, triple letter, empty" [disabled] [ref=e362]:
                    - generic [ref=e363]: 3L
                  - button "l13, empty" [disabled] [ref=e364]
                  - button "m13, empty" [disabled] [ref=e365]
                  - button "n13, empty" [disabled] [ref=e366]
                  - button "o13, empty" [disabled] [ref=e367]
                  - generic [ref=e368]: "14"
                  - button "a14, empty" [disabled] [ref=e369]
                  - button "b14, empty" [disabled] [ref=e370]
                  - button "c14, empty" [disabled] [ref=e371]
                  - button "2L, d14, double letter, empty" [disabled] [ref=e372]:
                    - generic [ref=e373]: 2L
                  - button "e14, empty" [disabled] [ref=e374]
                  - button "f14, empty" [disabled] [ref=e375]
                  - button "2W, g14, double word, empty" [disabled] [ref=e376]:
                    - generic [ref=e377]: 2W
                  - button "h14, empty" [disabled] [ref=e378]
                  - button "2W, i14, double word, empty" [disabled] [ref=e379]:
                    - generic [ref=e380]: 2W
                  - button "j14, empty" [disabled] [ref=e381]
                  - button "k14, empty" [disabled] [ref=e382]
                  - button "2L, l14, double letter, empty" [disabled] [ref=e383]:
                    - generic [ref=e384]: 2L
                  - button "m14, empty" [disabled] [ref=e385]
                  - button "n14, empty" [disabled] [ref=e386]
                  - button "o14, empty" [disabled] [ref=e387]
                  - generic [ref=e388]: "15"
                  - button "2L, a15, double letter, empty" [disabled] [ref=e389]:
                    - generic [ref=e390]: 2L
                  - button "b15, empty" [disabled] [ref=e391]
                  - button "c15, empty" [disabled] [ref=e392]
                  - button "d15, empty" [disabled] [ref=e393]
                  - button "3W, e15, triple word, empty" [disabled] [ref=e394]:
                    - generic [ref=e395]: 3W
                  - button "f15, empty" [disabled] [ref=e396]
                  - button "g15, empty" [disabled] [ref=e397]
                  - button "2L, h15, double letter, empty" [disabled] [ref=e398]:
                    - generic [ref=e399]: 2L
                  - button "i15, empty" [disabled] [ref=e400]
                  - button "j15, empty" [disabled] [ref=e401]
                  - button "3W, k15, triple word, empty" [disabled] [ref=e402]:
                    - generic [ref=e403]: 3W
                  - button "l15, empty" [disabled] [ref=e404]
                  - button "m15, empty" [disabled] [ref=e405]
                  - button "n15, empty" [disabled] [ref=e406]
                  - button "2L, o15, double letter, empty" [disabled] [ref=e407]:
                    - generic [ref=e408]: 2L
          - status [ref=e410]:
            - generic [ref=e411]:
              - generic [ref=e412]: "Amber: avery. Teal: jordan_plays."
              - text: A player used their last tile with the bag empty. Everyone else's tiles count against them and go to that player.
          - generic [ref=e415]:
            - generic [ref=e419]:
              - generic [ref=e420]:
                - img "Amber" [ref=e421]
                - generic "avery" [ref=e424]
              - generic [ref=e427]: 0 tiles
            - generic [ref=e428]:
              - generic [ref=e429]: Score
              - generic [ref=e430]: "187"
        - generic [ref=e431]:
          - list "Standings" [ref=e433]:
            - listitem [ref=e434]:
              - generic [ref=e435]:
                - generic [ref=e436]: 1st
                - generic [ref=e439]: avery
                - generic [ref=e440]:
                  - generic [ref=e441]: Score
                  - text: "187"
            - listitem [ref=e442]:
              - generic [ref=e443]:
                - generic [ref=e444]: 2nd
                - generic [ref=e447]: jordan_plays
                - generic [ref=e448]:
                  - generic [ref=e449]: Score
                  - text: "154"
          - button "History and stats" [ref=e452] [cursor=pointer]:
            - generic [ref=e454]:
              - paragraph [ref=e455]: History and stats
              - img [ref=e458]
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