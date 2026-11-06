# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--game-over dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  34870 pixels (ratio 0.11 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/game-over-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/game-over-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 34870 pixels (ratio 0.11 of all image pixels) are different.
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
  - 34870 pixels (ratio 0.11 of all image pixels) are different.

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
      - generic [ref=e24]:
        - paragraph [ref=e29]: No moves yet.
        - button "All moves" [ref=e30] [cursor=pointer]:
          - img [ref=e34]
      - generic [ref=e36]:
        - generic [ref=e38]:
          - generic [ref=e40]:
            - generic [ref=e44]:
              - generic [ref=e45]:
                - img "Teal" [ref=e46]
                - generic [ref=e47]: jordan_plays
              - generic [ref=e50]: 2 tiles
            - generic [ref=e51]:
              - generic [ref=e52]: Score
              - generic [ref=e53]: "154"
          - generic [ref=e55]:
            - group "Your rack" [ref=e56]
            - generic [ref=e57]:
              - generic [ref=e58]:
                - button "Fit board" [pressed] [ref=e59] [cursor=pointer]:
                  - paragraph [ref=e62]: Fit board
                - button "Enlarge board" [ref=e63] [cursor=pointer]:
                  - paragraph [ref=e66]: Enlarge board
              - region "Scrollable word board" [ref=e67]:
                - group "Word board, fifteen columns and fifteen rows" [ref=e68]:
                  - generic [ref=e70]: a
                  - generic [ref=e71]: b
                  - generic [ref=e72]: c
                  - generic [ref=e73]: d
                  - generic [ref=e74]: e
                  - generic [ref=e75]: f
                  - generic [ref=e76]: g
                  - generic [ref=e77]: h
                  - generic [ref=e78]: i
                  - generic [ref=e79]: j
                  - generic [ref=e80]: k
                  - generic [ref=e81]: l
                  - generic [ref=e82]: m
                  - generic [ref=e83]: "n"
                  - generic [ref=e84]: o
                  - generic [ref=e85]: "1"
                  - button "2L, a1, double letter, empty" [disabled] [ref=e86]:
                    - generic [ref=e87]: 2L
                  - button "b1, empty" [disabled] [ref=e88]
                  - button "c1, empty" [disabled] [ref=e89]
                  - button "d1, empty" [disabled] [ref=e90]
                  - button "3W, e1, triple word, empty" [disabled] [ref=e91]:
                    - generic [ref=e92]: 3W
                  - button "f1, empty" [disabled] [ref=e93]
                  - button "g1, empty" [disabled] [ref=e94]
                  - button "2L, h1, double letter, empty" [disabled] [ref=e95]:
                    - generic [ref=e96]: 2L
                  - button "i1, empty" [disabled] [ref=e97]
                  - button "j1, empty" [disabled] [ref=e98]
                  - button "3W, k1, triple word, empty" [disabled] [ref=e99]:
                    - generic [ref=e100]: 3W
                  - button "l1, empty" [disabled] [ref=e101]
                  - button "m1, empty" [disabled] [ref=e102]
                  - button "n1, empty" [disabled] [ref=e103]
                  - button "2L, o1, double letter, empty" [disabled] [ref=e104]:
                    - generic [ref=e105]: 2L
                  - generic [ref=e106]: "2"
                  - button "a2, empty" [disabled] [ref=e107]
                  - button "b2, empty" [disabled] [ref=e108]
                  - button "c2, empty" [disabled] [ref=e109]
                  - button "2L, d2, double letter, empty" [disabled] [ref=e110]:
                    - generic [ref=e111]: 2L
                  - button "e2, empty" [disabled] [ref=e112]
                  - button "f2, empty" [disabled] [ref=e113]
                  - button "2W, g2, double word, empty" [disabled] [ref=e114]:
                    - generic [ref=e115]: 2W
                  - button "h2, empty" [disabled] [ref=e116]
                  - button "2W, i2, double word, empty" [disabled] [ref=e117]:
                    - generic [ref=e118]: 2W
                  - button "j2, empty" [disabled] [ref=e119]
                  - button "k2, empty" [disabled] [ref=e120]
                  - button "2L, l2, double letter, empty" [disabled] [ref=e121]:
                    - generic [ref=e122]: 2L
                  - button "m2, empty" [disabled] [ref=e123]
                  - button "n2, empty" [disabled] [ref=e124]
                  - button "o2, empty" [disabled] [ref=e125]
                  - generic [ref=e126]: "3"
                  - button "a3, empty" [disabled] [ref=e127]
                  - button "b3, empty" [disabled] [ref=e128]
                  - button "c3, empty" [disabled] [ref=e129]
                  - button "d3, empty" [disabled] [ref=e130]
                  - button "3L, e3, triple letter, empty" [disabled] [ref=e131]:
                    - generic [ref=e132]: 3L
                  - button "f3, empty" [disabled] [ref=e133]
                  - button "g3, empty" [disabled] [ref=e134]
                  - button "h3, empty" [disabled] [ref=e135]
                  - button "i3, empty" [disabled] [ref=e136]
                  - button "j3, empty" [disabled] [ref=e137]
                  - button "3L, k3, triple letter, empty" [disabled] [ref=e138]:
                    - generic [ref=e139]: 3L
                  - button "l3, empty" [disabled] [ref=e140]
                  - button "m3, empty" [disabled] [ref=e141]
                  - button "n3, empty" [disabled] [ref=e142]
                  - button "o3, empty" [disabled] [ref=e143]
                  - generic [ref=e144]: "4"
                  - button "a4, empty" [disabled] [ref=e145]
                  - button "2L, b4, double letter, empty" [disabled] [ref=e146]:
                    - generic [ref=e147]: 2L
                  - button "c4, empty" [disabled] [ref=e148]
                  - button "2W, d4, double word, empty" [disabled] [ref=e149]:
                    - generic [ref=e150]: 2W
                  - button "e4, empty" [disabled] [ref=e151]
                  - button "f4, empty" [disabled] [ref=e152]
                  - button "g4, empty" [disabled] [ref=e153]
                  - button "h4, empty" [disabled] [ref=e154]
                  - button "i4, empty" [disabled] [ref=e155]
                  - button "j4, empty" [disabled] [ref=e156]
                  - button "k4, empty" [disabled] [ref=e157]
                  - button "2W, l4, double word, empty" [disabled] [ref=e158]:
                    - generic [ref=e159]: 2W
                  - button "m4, empty" [disabled] [ref=e160]
                  - button "2L, n4, double letter, empty" [disabled] [ref=e161]:
                    - generic [ref=e162]: 2L
                  - button "o4, empty" [disabled] [ref=e163]
                  - generic [ref=e164]: "5"
                  - button "3W, a5, triple word, empty" [disabled] [ref=e165]:
                    - generic [ref=e166]: 3W
                  - button "b5, empty" [disabled] [ref=e167]
                  - button "3L, c5, triple letter, empty" [disabled] [ref=e168]:
                    - generic [ref=e169]: 3L
                  - button "d5, empty" [disabled] [ref=e170]
                  - button "e5, empty" [disabled] [ref=e171]
                  - button "f5, empty" [disabled] [ref=e172]
                  - button "2L, g5, double letter, empty" [disabled] [ref=e173]:
                    - generic [ref=e174]: 2L
                  - button "h5, empty" [disabled] [ref=e175]
                  - button "2L, i5, double letter, empty" [disabled] [ref=e176]:
                    - generic [ref=e177]: 2L
                  - button "j5, empty" [disabled] [ref=e178]
                  - button "k5, empty" [disabled] [ref=e179]
                  - button "l5, empty" [disabled] [ref=e180]
                  - button "3L, m5, triple letter, empty" [disabled] [ref=e181]:
                    - generic [ref=e182]: 3L
                  - button "n5, empty" [disabled] [ref=e183]
                  - button "3W, o5, triple word, empty" [disabled] [ref=e184]:
                    - generic [ref=e185]: 3W
                  - generic [ref=e186]: "6"
                  - button "a6, empty" [disabled] [ref=e187]
                  - button "b6, empty" [disabled] [ref=e188]
                  - button "c6, empty" [disabled] [ref=e189]
                  - button "d6, empty" [disabled] [ref=e190]
                  - button "e6, empty" [disabled] [ref=e191]
                  - button "f6, empty" [disabled] [ref=e192]
                  - button "g6, empty" [disabled] [ref=e193]
                  - button "3L, h6, triple letter, empty" [disabled] [ref=e194]:
                    - generic [ref=e195]: 3L
                  - button "i6, empty" [disabled] [ref=e196]
                  - button "j6, empty" [disabled] [ref=e197]
                  - button "k6, empty" [disabled] [ref=e198]
                  - button "l6, empty" [disabled] [ref=e199]
                  - button "m6, empty" [disabled] [ref=e200]
                  - button "n6, empty" [disabled] [ref=e201]
                  - button "o6, empty" [disabled] [ref=e202]
                  - generic [ref=e203]: "7"
                  - button "a7, empty" [disabled] [ref=e204]
                  - button "2W, b7, double word, empty" [disabled] [ref=e205]:
                    - generic [ref=e206]: 2W
                  - button "c7, empty" [disabled] [ref=e207]
                  - button "d7, empty" [disabled] [ref=e208]
                  - button "2L, e7, double letter, empty" [disabled] [ref=e209]:
                    - generic [ref=e210]: 2L
                  - button "f7, empty" [disabled] [ref=e211]
                  - button "2L, g7, double letter, empty" [disabled] [ref=e212]:
                    - generic [ref=e213]: 2L
                  - button "h7, empty" [disabled] [ref=e214]
                  - button "2L, i7, double letter, empty" [disabled] [ref=e215]:
                    - generic [ref=e216]: 2L
                  - button "j7, empty" [disabled] [ref=e217]
                  - button "2L, k7, double letter, empty" [disabled] [ref=e218]:
                    - generic [ref=e219]: 2L
                  - button "l7, empty" [disabled] [ref=e220]
                  - button "m7, empty" [disabled] [ref=e221]
                  - button "2W, n7, double word, empty" [disabled] [ref=e222]:
                    - generic [ref=e223]: 2W
                  - button "o7, empty" [disabled] [ref=e224]
                  - generic [ref=e225]: "8"
                  - button "2L, a8, double letter, empty" [disabled] [ref=e226]:
                    - generic [ref=e227]: 2L
                  - button "b8, empty" [disabled] [ref=e228]
                  - button "c8, empty" [disabled] [ref=e229]
                  - button "d8, empty" [disabled] [ref=e230]
                  - button "e8, empty" [disabled] [ref=e231]
                  - button "3L, f8, triple letter, empty" [disabled] [ref=e232]:
                    - generic [ref=e233]: 3L
                  - button "C 3, g8, committed" [disabled] [ref=e234]:
                    - generic [ref=e235]: C
                  - button "A 1, h8, committed" [disabled] [ref=e236]:
                    - generic [ref=e237]: A
                  - button "T 1, i8, committed" [disabled] [ref=e238]:
                    - generic [ref=e239]: T
                  - button "3L, j8, triple letter, empty" [disabled] [ref=e240]:
                    - generic [ref=e241]: 3L
                  - button "k8, empty" [disabled] [ref=e242]
                  - button "l8, empty" [disabled] [ref=e243]
                  - button "m8, empty" [disabled] [ref=e244]
                  - button "n8, empty" [disabled] [ref=e245]
                  - button "2L, o8, double letter, empty" [disabled] [ref=e246]:
                    - generic [ref=e247]: 2L
                  - generic [ref=e248]: "9"
                  - button "a9, empty" [disabled] [ref=e249]
                  - button "2W, b9, double word, empty" [disabled] [ref=e250]:
                    - generic [ref=e251]: 2W
                  - button "c9, empty" [disabled] [ref=e252]
                  - button "d9, empty" [disabled] [ref=e253]
                  - button "2L, e9, double letter, empty" [disabled] [ref=e254]:
                    - generic [ref=e255]: 2L
                  - button "f9, empty" [disabled] [ref=e256]
                  - button "2L, g9, double letter, empty" [disabled] [ref=e257]:
                    - generic [ref=e258]: 2L
                  - button "h9, empty" [disabled] [ref=e259]
                  - button "O 1, i9, committed" [disabled] [ref=e260]:
                    - generic [ref=e261]: O
                  - button "j9, empty" [disabled] [ref=e262]
                  - button "2L, k9, double letter, empty" [disabled] [ref=e263]:
                    - generic [ref=e264]: 2L
                  - button "l9, empty" [disabled] [ref=e265]
                  - button "m9, empty" [disabled] [ref=e266]
                  - button "2W, n9, double word, empty" [disabled] [ref=e267]:
                    - generic [ref=e268]: 2W
                  - button "o9, empty" [disabled] [ref=e269]
                  - generic [ref=e270]: "10"
                  - button "a10, empty" [disabled] [ref=e271]
                  - button "b10, empty" [disabled] [ref=e272]
                  - button "c10, empty" [disabled] [ref=e273]
                  - button "d10, empty" [disabled] [ref=e274]
                  - button "e10, empty" [disabled] [ref=e275]
                  - button "f10, empty" [disabled] [ref=e276]
                  - button "g10, empty" [disabled] [ref=e277]
                  - button "3L, h10, triple letter, empty" [disabled] [ref=e278]:
                    - generic [ref=e279]: 3L
                  - button "E 1, i10, committed" [disabled] [ref=e280]:
                    - generic [ref=e281]: E
                  - button "j10, empty" [disabled] [ref=e282]
                  - button "k10, empty" [disabled] [ref=e283]
                  - button "l10, empty" [disabled] [ref=e284]
                  - button "m10, empty" [disabled] [ref=e285]
                  - button "n10, empty" [disabled] [ref=e286]
                  - button "o10, empty" [disabled] [ref=e287]
                  - generic [ref=e288]: "11"
                  - button "3W, a11, triple word, empty" [disabled] [ref=e289]:
                    - generic [ref=e290]: 3W
                  - button "b11, empty" [disabled] [ref=e291]
                  - button "3L, c11, triple letter, empty" [disabled] [ref=e292]:
                    - generic [ref=e293]: 3L
                  - button "d11, empty" [disabled] [ref=e294]
                  - button "e11, empty" [disabled] [ref=e295]
                  - button "f11, empty" [disabled] [ref=e296]
                  - button "2L, g11, double letter, empty" [disabled] [ref=e297]:
                    - generic [ref=e298]: 2L
                  - button "h11, empty" [disabled] [ref=e299]
                  - button "2L, i11, double letter, empty" [disabled] [ref=e300]:
                    - generic [ref=e301]: 2L
                  - button "j11, empty" [disabled] [ref=e302]
                  - button "k11, empty" [disabled] [ref=e303]
                  - button "l11, empty" [disabled] [ref=e304]
                  - button "3L, m11, triple letter, empty" [disabled] [ref=e305]:
                    - generic [ref=e306]: 3L
                  - button "n11, empty" [disabled] [ref=e307]
                  - button "3W, o11, triple word, empty" [disabled] [ref=e308]:
                    - generic [ref=e309]: 3W
                  - generic [ref=e310]: "12"
                  - button "a12, empty" [disabled] [ref=e311]
                  - button "2L, b12, double letter, empty" [disabled] [ref=e312]:
                    - generic [ref=e313]: 2L
                  - button "c12, empty" [disabled] [ref=e314]
                  - button "2W, d12, double word, empty" [disabled] [ref=e315]:
                    - generic [ref=e316]: 2W
                  - button "e12, empty" [disabled] [ref=e317]
                  - button "f12, empty" [disabled] [ref=e318]
                  - button "g12, empty" [disabled] [ref=e319]
                  - button "h12, empty" [disabled] [ref=e320]
                  - button "i12, empty" [disabled] [ref=e321]
                  - button "j12, empty" [disabled] [ref=e322]
                  - button "k12, empty" [disabled] [ref=e323]
                  - button "2W, l12, double word, empty" [disabled] [ref=e324]:
                    - generic [ref=e325]: 2W
                  - button "m12, empty" [disabled] [ref=e326]
                  - button "2L, n12, double letter, empty" [disabled] [ref=e327]:
                    - generic [ref=e328]: 2L
                  - button "o12, empty" [disabled] [ref=e329]
                  - generic [ref=e330]: "13"
                  - button "a13, empty" [disabled] [ref=e331]
                  - button "b13, empty" [disabled] [ref=e332]
                  - button "c13, empty" [disabled] [ref=e333]
                  - button "d13, empty" [disabled] [ref=e334]
                  - button "3L, e13, triple letter, empty" [disabled] [ref=e335]:
                    - generic [ref=e336]: 3L
                  - button "f13, empty" [disabled] [ref=e337]
                  - button "g13, empty" [disabled] [ref=e338]
                  - button "h13, empty" [disabled] [ref=e339]
                  - button "i13, empty" [disabled] [ref=e340]
                  - button "j13, empty" [disabled] [ref=e341]
                  - button "3L, k13, triple letter, empty" [disabled] [ref=e342]:
                    - generic [ref=e343]: 3L
                  - button "l13, empty" [disabled] [ref=e344]
                  - button "m13, empty" [disabled] [ref=e345]
                  - button "n13, empty" [disabled] [ref=e346]
                  - button "o13, empty" [disabled] [ref=e347]
                  - generic [ref=e348]: "14"
                  - button "a14, empty" [disabled] [ref=e349]
                  - button "b14, empty" [disabled] [ref=e350]
                  - button "c14, empty" [disabled] [ref=e351]
                  - button "2L, d14, double letter, empty" [disabled] [ref=e352]:
                    - generic [ref=e353]: 2L
                  - button "e14, empty" [disabled] [ref=e354]
                  - button "f14, empty" [disabled] [ref=e355]
                  - button "2W, g14, double word, empty" [disabled] [ref=e356]:
                    - generic [ref=e357]: 2W
                  - button "h14, empty" [disabled] [ref=e358]
                  - button "2W, i14, double word, empty" [disabled] [ref=e359]:
                    - generic [ref=e360]: 2W
                  - button "j14, empty" [disabled] [ref=e361]
                  - button "k14, empty" [disabled] [ref=e362]
                  - button "2L, l14, double letter, empty" [disabled] [ref=e363]:
                    - generic [ref=e364]: 2L
                  - button "m14, empty" [disabled] [ref=e365]
                  - button "n14, empty" [disabled] [ref=e366]
                  - button "o14, empty" [disabled] [ref=e367]
                  - generic [ref=e368]: "15"
                  - button "2L, a15, double letter, empty" [disabled] [ref=e369]:
                    - generic [ref=e370]: 2L
                  - button "b15, empty" [disabled] [ref=e371]
                  - button "c15, empty" [disabled] [ref=e372]
                  - button "d15, empty" [disabled] [ref=e373]
                  - button "3W, e15, triple word, empty" [disabled] [ref=e374]:
                    - generic [ref=e375]: 3W
                  - button "f15, empty" [disabled] [ref=e376]
                  - button "g15, empty" [disabled] [ref=e377]
                  - button "2L, h15, double letter, empty" [disabled] [ref=e378]:
                    - generic [ref=e379]: 2L
                  - button "i15, empty" [disabled] [ref=e380]
                  - button "j15, empty" [disabled] [ref=e381]
                  - button "3W, k15, triple word, empty" [disabled] [ref=e382]:
                    - generic [ref=e383]: 3W
                  - button "l15, empty" [disabled] [ref=e384]
                  - button "m15, empty" [disabled] [ref=e385]
                  - button "n15, empty" [disabled] [ref=e386]
                  - button "2L, o15, double letter, empty" [disabled] [ref=e387]:
                    - generic [ref=e388]: 2L
          - status [ref=e392]:
            - generic [ref=e393]:
              - generic [ref=e394]: "Amber: avery. Teal: jordan_plays."
              - text: A player used their last tile with the bag empty. Everyone else's tiles count against them and go to that player.
          - generic [ref=e397]:
            - generic [ref=e401]:
              - generic [ref=e402]:
                - img "Amber" [ref=e403]
                - generic [ref=e404]: avery
              - generic [ref=e407]: 0 tiles
            - generic [ref=e408]:
              - generic [ref=e409]: Score
              - generic [ref=e410]: "187"
        - generic [ref=e411]:
          - generic [ref=e412]:
            - heading "You win" [level=2] [ref=e414]
            - list "Standings" [ref=e415]:
              - listitem [ref=e416]:
                - generic [ref=e417]:
                  - generic [ref=e418]: 1st
                  - generic [ref=e421]: avery
                  - generic [ref=e422]:
                    - generic [ref=e423]: Score
                    - text: "187"
              - listitem [ref=e424]:
                - generic [ref=e425]:
                  - generic [ref=e426]: 2nd
                  - generic [ref=e429]: jordan_plays
                  - generic [ref=e430]:
                    - generic [ref=e431]: Score
                    - text: "154"
          - generic [ref=e433]:
            - group "What next" [ref=e434]:
              - button "Rematch" [ref=e435] [cursor=pointer]:
                - paragraph [ref=e438]: Rematch
              - button "Change game" [ref=e439] [cursor=pointer]:
                - paragraph [ref=e442]: Change game
              - button "Review" [ref=e443] [cursor=pointer]:
                - paragraph [ref=e446]: Review
            - button "History and stats" [ref=e447] [cursor=pointer]:
              - generic [ref=e449]:
                - paragraph [ref=e450]: History and stats
                - img [ref=e453]
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