# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--four-players dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  35259 pixels (ratio 0.11 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/four-players-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/four-players-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 35259 pixels (ratio 0.11 of all image pixels) are different.
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
  - 35259 pixels (ratio 0.11 of all image pixels) are different.

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
        - paragraph [ref=e24]: Violet — to play · 67 tiles in the bag
        - generic [ref=e25]:
          - paragraph [ref=e30]: No moves yet.
          - button "All moves" [ref=e31] [cursor=pointer]:
            - img [ref=e35]
      - generic [ref=e37]:
        - generic [ref=e39]:
          - list "Players" [ref=e40]:
            - listitem [ref=e41]:
              - generic [ref=e46]:
                - generic [ref=e47]: avery
                - generic [ref=e48]:
                  - generic [ref=e50]: Score 10
                  - generic [ref=e52]: You
                  - generic [ref=e54]: 7 tiles
            - listitem [ref=e55]:
              - generic [ref=e59]:
                - generic [ref=e60]: jordan_plays
                - generic [ref=e61]:
                  - generic [ref=e63]: Score 3
                  - generic [ref=e65]: 7 tiles
            - listitem [ref=e66]:
              - generic [ref=e70]:
                - generic [ref=e71]: morgan
                - generic [ref=e72]:
                  - generic [ref=e74]: Score 0
                  - generic [ref=e76]: 7 tiles
            - listitem [ref=e77]:
              - generic [ref=e81]:
                - generic [ref=e82]: robin_42
                - generic [ref=e83]:
                  - generic [ref=e85]: Score 0
                  - generic [ref=e87]: 7 tiles
          - generic [ref=e89]:
            - paragraph [ref=e90]: You are watching. Racks stay private to their players.
            - generic [ref=e91]:
              - generic [ref=e92]:
                - button "Fit board" [pressed] [ref=e93] [cursor=pointer]:
                  - paragraph [ref=e96]: Fit board
                - button "Enlarge board" [ref=e97] [cursor=pointer]:
                  - paragraph [ref=e100]: Enlarge board
              - region "Scrollable word board" [ref=e102]:
                - group "Word board, fifteen columns and fifteen rows" [ref=e103]:
                  - generic [ref=e105]: a
                  - generic [ref=e106]: b
                  - generic [ref=e107]: c
                  - generic [ref=e108]: d
                  - generic [ref=e109]: e
                  - generic [ref=e110]: f
                  - generic [ref=e111]: g
                  - generic [ref=e112]: h
                  - generic [ref=e113]: i
                  - generic [ref=e114]: j
                  - generic [ref=e115]: k
                  - generic [ref=e116]: l
                  - generic [ref=e117]: m
                  - generic [ref=e118]: "n"
                  - generic [ref=e119]: o
                  - generic [ref=e120]: "1"
                  - button "2L, a1, double letter, empty" [disabled] [ref=e121]:
                    - generic [ref=e122]: 2L
                  - button "b1, empty" [disabled] [ref=e123]
                  - button "c1, empty" [disabled] [ref=e124]
                  - button "d1, empty" [disabled] [ref=e125]
                  - button "3W, e1, triple word, empty" [disabled] [ref=e126]:
                    - generic [ref=e127]: 3W
                  - button "f1, empty" [disabled] [ref=e128]
                  - button "g1, empty" [disabled] [ref=e129]
                  - button "2L, h1, double letter, empty" [disabled] [ref=e130]:
                    - generic [ref=e131]: 2L
                  - button "i1, empty" [disabled] [ref=e132]
                  - button "j1, empty" [disabled] [ref=e133]
                  - button "3W, k1, triple word, empty" [disabled] [ref=e134]:
                    - generic [ref=e135]: 3W
                  - button "l1, empty" [disabled] [ref=e136]
                  - button "m1, empty" [disabled] [ref=e137]
                  - button "n1, empty" [disabled] [ref=e138]
                  - button "2L, o1, double letter, empty" [disabled] [ref=e139]:
                    - generic [ref=e140]: 2L
                  - generic [ref=e141]: "2"
                  - button "a2, empty" [disabled] [ref=e142]
                  - button "b2, empty" [disabled] [ref=e143]
                  - button "c2, empty" [disabled] [ref=e144]
                  - button "2L, d2, double letter, empty" [disabled] [ref=e145]:
                    - generic [ref=e146]: 2L
                  - button "e2, empty" [disabled] [ref=e147]
                  - button "f2, empty" [disabled] [ref=e148]
                  - button "2W, g2, double word, empty" [disabled] [ref=e149]:
                    - generic [ref=e150]: 2W
                  - button "h2, empty" [disabled] [ref=e151]
                  - button "2W, i2, double word, empty" [disabled] [ref=e152]:
                    - generic [ref=e153]: 2W
                  - button "j2, empty" [disabled] [ref=e154]
                  - button "k2, empty" [disabled] [ref=e155]
                  - button "2L, l2, double letter, empty" [disabled] [ref=e156]:
                    - generic [ref=e157]: 2L
                  - button "m2, empty" [disabled] [ref=e158]
                  - button "n2, empty" [disabled] [ref=e159]
                  - button "o2, empty" [disabled] [ref=e160]
                  - generic [ref=e161]: "3"
                  - button "a3, empty" [disabled] [ref=e162]
                  - button "b3, empty" [disabled] [ref=e163]
                  - button "c3, empty" [disabled] [ref=e164]
                  - button "d3, empty" [disabled] [ref=e165]
                  - button "3L, e3, triple letter, empty" [disabled] [ref=e166]:
                    - generic [ref=e167]: 3L
                  - button "f3, empty" [disabled] [ref=e168]
                  - button "g3, empty" [disabled] [ref=e169]
                  - button "h3, empty" [disabled] [ref=e170]
                  - button "i3, empty" [disabled] [ref=e171]
                  - button "j3, empty" [disabled] [ref=e172]
                  - button "3L, k3, triple letter, empty" [disabled] [ref=e173]:
                    - generic [ref=e174]: 3L
                  - button "l3, empty" [disabled] [ref=e175]
                  - button "m3, empty" [disabled] [ref=e176]
                  - button "n3, empty" [disabled] [ref=e177]
                  - button "o3, empty" [disabled] [ref=e178]
                  - generic [ref=e179]: "4"
                  - button "a4, empty" [disabled] [ref=e180]
                  - button "2L, b4, double letter, empty" [disabled] [ref=e181]:
                    - generic [ref=e182]: 2L
                  - button "c4, empty" [disabled] [ref=e183]
                  - button "2W, d4, double word, empty" [disabled] [ref=e184]:
                    - generic [ref=e185]: 2W
                  - button "e4, empty" [disabled] [ref=e186]
                  - button "f4, empty" [disabled] [ref=e187]
                  - button "g4, empty" [disabled] [ref=e188]
                  - button "h4, empty" [disabled] [ref=e189]
                  - button "i4, empty" [disabled] [ref=e190]
                  - button "j4, empty" [disabled] [ref=e191]
                  - button "k4, empty" [disabled] [ref=e192]
                  - button "2W, l4, double word, empty" [disabled] [ref=e193]:
                    - generic [ref=e194]: 2W
                  - button "m4, empty" [disabled] [ref=e195]
                  - button "2L, n4, double letter, empty" [disabled] [ref=e196]:
                    - generic [ref=e197]: 2L
                  - button "o4, empty" [disabled] [ref=e198]
                  - generic [ref=e199]: "5"
                  - button "3W, a5, triple word, empty" [disabled] [ref=e200]:
                    - generic [ref=e201]: 3W
                  - button "b5, empty" [disabled] [ref=e202]
                  - button "3L, c5, triple letter, empty" [disabled] [ref=e203]:
                    - generic [ref=e204]: 3L
                  - button "d5, empty" [disabled] [ref=e205]
                  - button "e5, empty" [disabled] [ref=e206]
                  - button "f5, empty" [disabled] [ref=e207]
                  - button "2L, g5, double letter, empty" [disabled] [ref=e208]:
                    - generic [ref=e209]: 2L
                  - button "h5, empty" [disabled] [ref=e210]
                  - button "2L, i5, double letter, empty" [disabled] [ref=e211]:
                    - generic [ref=e212]: 2L
                  - button "j5, empty" [disabled] [ref=e213]
                  - button "k5, empty" [disabled] [ref=e214]
                  - button "l5, empty" [disabled] [ref=e215]
                  - button "3L, m5, triple letter, empty" [disabled] [ref=e216]:
                    - generic [ref=e217]: 3L
                  - button "n5, empty" [disabled] [ref=e218]
                  - button "3W, o5, triple word, empty" [disabled] [ref=e219]:
                    - generic [ref=e220]: 3W
                  - generic [ref=e221]: "6"
                  - button "a6, empty" [disabled] [ref=e222]
                  - button "b6, empty" [disabled] [ref=e223]
                  - button "c6, empty" [disabled] [ref=e224]
                  - button "d6, empty" [disabled] [ref=e225]
                  - button "e6, empty" [disabled] [ref=e226]
                  - button "f6, empty" [disabled] [ref=e227]
                  - button "g6, empty" [disabled] [ref=e228]
                  - button "3L, h6, triple letter, empty" [disabled] [ref=e229]:
                    - generic [ref=e230]: 3L
                  - button "i6, empty" [disabled] [ref=e231]
                  - button "j6, empty" [disabled] [ref=e232]
                  - button "k6, empty" [disabled] [ref=e233]
                  - button "l6, empty" [disabled] [ref=e234]
                  - button "m6, empty" [disabled] [ref=e235]
                  - button "n6, empty" [disabled] [ref=e236]
                  - button "o6, empty" [disabled] [ref=e237]
                  - generic [ref=e238]: "7"
                  - button "a7, empty" [disabled] [ref=e239]
                  - button "2W, b7, double word, empty" [disabled] [ref=e240]:
                    - generic [ref=e241]: 2W
                  - button "c7, empty" [disabled] [ref=e242]
                  - button "d7, empty" [disabled] [ref=e243]
                  - button "2L, e7, double letter, empty" [disabled] [ref=e244]:
                    - generic [ref=e245]: 2L
                  - button "f7, empty" [disabled] [ref=e246]
                  - button "2L, g7, double letter, empty" [disabled] [ref=e247]:
                    - generic [ref=e248]: 2L
                  - button "h7, empty" [disabled] [ref=e249]
                  - button "2L, i7, double letter, empty" [disabled] [ref=e250]:
                    - generic [ref=e251]: 2L
                  - button "j7, empty" [disabled] [ref=e252]
                  - button "2L, k7, double letter, empty" [disabled] [ref=e253]:
                    - generic [ref=e254]: 2L
                  - button "l7, empty" [disabled] [ref=e255]
                  - button "m7, empty" [disabled] [ref=e256]
                  - button "2W, n7, double word, empty" [disabled] [ref=e257]:
                    - generic [ref=e258]: 2W
                  - button "o7, empty" [disabled] [ref=e259]
                  - generic [ref=e260]: "8"
                  - button "2L, a8, double letter, empty" [disabled] [ref=e261]:
                    - generic [ref=e262]: 2L
                  - button "b8, empty" [disabled] [ref=e263]
                  - button "c8, empty" [disabled] [ref=e264]
                  - button "d8, empty" [disabled] [ref=e265]
                  - button "e8, empty" [disabled] [ref=e266]
                  - button "3L, f8, triple letter, empty" [disabled] [ref=e267]:
                    - generic [ref=e268]: 3L
                  - button "C 3, g8, committed" [disabled] [ref=e269]:
                    - generic [ref=e270]: C
                  - button "A 1, h8, committed" [disabled] [ref=e271]:
                    - generic [ref=e272]: A
                  - button "T 1, i8, committed" [disabled] [ref=e273]:
                    - generic [ref=e274]: T
                  - button "3L, j8, triple letter, empty" [disabled] [ref=e275]:
                    - generic [ref=e276]: 3L
                  - button "k8, empty" [disabled] [ref=e277]
                  - button "l8, empty" [disabled] [ref=e278]
                  - button "m8, empty" [disabled] [ref=e279]
                  - button "n8, empty" [disabled] [ref=e280]
                  - button "2L, o8, double letter, empty" [disabled] [ref=e281]:
                    - generic [ref=e282]: 2L
                  - generic [ref=e283]: "9"
                  - button "a9, empty" [disabled] [ref=e284]
                  - button "2W, b9, double word, empty" [disabled] [ref=e285]:
                    - generic [ref=e286]: 2W
                  - button "c9, empty" [disabled] [ref=e287]
                  - button "d9, empty" [disabled] [ref=e288]
                  - button "2L, e9, double letter, empty" [disabled] [ref=e289]:
                    - generic [ref=e290]: 2L
                  - button "f9, empty" [disabled] [ref=e291]
                  - button "2L, g9, double letter, empty" [disabled] [ref=e292]:
                    - generic [ref=e293]: 2L
                  - button "h9, empty" [disabled] [ref=e294]
                  - button "O 1, i9, committed" [disabled] [ref=e295]:
                    - generic [ref=e296]: O
                  - button "j9, empty" [disabled] [ref=e297]
                  - button "2L, k9, double letter, empty" [disabled] [ref=e298]:
                    - generic [ref=e299]: 2L
                  - button "l9, empty" [disabled] [ref=e300]
                  - button "m9, empty" [disabled] [ref=e301]
                  - button "2W, n9, double word, empty" [disabled] [ref=e302]:
                    - generic [ref=e303]: 2W
                  - button "o9, empty" [disabled] [ref=e304]
                  - generic [ref=e305]: "10"
                  - button "a10, empty" [disabled] [ref=e306]
                  - button "b10, empty" [disabled] [ref=e307]
                  - button "c10, empty" [disabled] [ref=e308]
                  - button "d10, empty" [disabled] [ref=e309]
                  - button "e10, empty" [disabled] [ref=e310]
                  - button "f10, empty" [disabled] [ref=e311]
                  - button "g10, empty" [disabled] [ref=e312]
                  - button "3L, h10, triple letter, empty" [disabled] [ref=e313]:
                    - generic [ref=e314]: 3L
                  - button "E 1, i10, committed" [disabled] [ref=e315]:
                    - generic [ref=e316]: E
                  - button "j10, empty" [disabled] [ref=e317]
                  - button "k10, empty" [disabled] [ref=e318]
                  - button "l10, empty" [disabled] [ref=e319]
                  - button "m10, empty" [disabled] [ref=e320]
                  - button "n10, empty" [disabled] [ref=e321]
                  - button "o10, empty" [disabled] [ref=e322]
                  - generic [ref=e323]: "11"
                  - button "3W, a11, triple word, empty" [disabled] [ref=e324]:
                    - generic [ref=e325]: 3W
                  - button "b11, empty" [disabled] [ref=e326]
                  - button "3L, c11, triple letter, empty" [disabled] [ref=e327]:
                    - generic [ref=e328]: 3L
                  - button "d11, empty" [disabled] [ref=e329]
                  - button "e11, empty" [disabled] [ref=e330]
                  - button "f11, empty" [disabled] [ref=e331]
                  - button "2L, g11, double letter, empty" [disabled] [ref=e332]:
                    - generic [ref=e333]: 2L
                  - button "h11, empty" [disabled] [ref=e334]
                  - button "2L, i11, double letter, empty" [disabled] [ref=e335]:
                    - generic [ref=e336]: 2L
                  - button "j11, empty" [disabled] [ref=e337]
                  - button "k11, empty" [disabled] [ref=e338]
                  - button "l11, empty" [disabled] [ref=e339]
                  - button "3L, m11, triple letter, empty" [disabled] [ref=e340]:
                    - generic [ref=e341]: 3L
                  - button "n11, empty" [disabled] [ref=e342]
                  - button "3W, o11, triple word, empty" [disabled] [ref=e343]:
                    - generic [ref=e344]: 3W
                  - generic [ref=e345]: "12"
                  - button "a12, empty" [disabled] [ref=e346]
                  - button "2L, b12, double letter, empty" [disabled] [ref=e347]:
                    - generic [ref=e348]: 2L
                  - button "c12, empty" [disabled] [ref=e349]
                  - button "2W, d12, double word, empty" [disabled] [ref=e350]:
                    - generic [ref=e351]: 2W
                  - button "e12, empty" [disabled] [ref=e352]
                  - button "f12, empty" [disabled] [ref=e353]
                  - button "g12, empty" [disabled] [ref=e354]
                  - button "h12, empty" [disabled] [ref=e355]
                  - button "i12, empty" [disabled] [ref=e356]
                  - button "j12, empty" [disabled] [ref=e357]
                  - button "k12, empty" [disabled] [ref=e358]
                  - button "2W, l12, double word, empty" [disabled] [ref=e359]:
                    - generic [ref=e360]: 2W
                  - button "m12, empty" [disabled] [ref=e361]
                  - button "2L, n12, double letter, empty" [disabled] [ref=e362]:
                    - generic [ref=e363]: 2L
                  - button "o12, empty" [disabled] [ref=e364]
                  - generic [ref=e365]: "13"
                  - button "a13, empty" [disabled] [ref=e366]
                  - button "b13, empty" [disabled] [ref=e367]
                  - button "c13, empty" [disabled] [ref=e368]
                  - button "d13, empty" [disabled] [ref=e369]
                  - button "3L, e13, triple letter, empty" [disabled] [ref=e370]:
                    - generic [ref=e371]: 3L
                  - button "f13, empty" [disabled] [ref=e372]
                  - button "g13, empty" [disabled] [ref=e373]
                  - button "h13, empty" [disabled] [ref=e374]
                  - button "i13, empty" [disabled] [ref=e375]
                  - button "j13, empty" [disabled] [ref=e376]
                  - button "3L, k13, triple letter, empty" [disabled] [ref=e377]:
                    - generic [ref=e378]: 3L
                  - button "l13, empty" [disabled] [ref=e379]
                  - button "m13, empty" [disabled] [ref=e380]
                  - button "n13, empty" [disabled] [ref=e381]
                  - button "o13, empty" [disabled] [ref=e382]
                  - generic [ref=e383]: "14"
                  - button "a14, empty" [disabled] [ref=e384]
                  - button "b14, empty" [disabled] [ref=e385]
                  - button "c14, empty" [disabled] [ref=e386]
                  - button "2L, d14, double letter, empty" [disabled] [ref=e387]:
                    - generic [ref=e388]: 2L
                  - button "e14, empty" [disabled] [ref=e389]
                  - button "f14, empty" [disabled] [ref=e390]
                  - button "2W, g14, double word, empty" [disabled] [ref=e391]:
                    - generic [ref=e392]: 2W
                  - button "h14, empty" [disabled] [ref=e393]
                  - button "2W, i14, double word, empty" [disabled] [ref=e394]:
                    - generic [ref=e395]: 2W
                  - button "j14, empty" [disabled] [ref=e396]
                  - button "k14, empty" [disabled] [ref=e397]
                  - button "2L, l14, double letter, empty" [disabled] [ref=e398]:
                    - generic [ref=e399]: 2L
                  - button "m14, empty" [disabled] [ref=e400]
                  - button "n14, empty" [disabled] [ref=e401]
                  - button "o14, empty" [disabled] [ref=e402]
                  - generic [ref=e403]: "15"
                  - button "2L, a15, double letter, empty" [disabled] [ref=e404]:
                    - generic [ref=e405]: 2L
                  - button "b15, empty" [disabled] [ref=e406]
                  - button "c15, empty" [disabled] [ref=e407]
                  - button "d15, empty" [disabled] [ref=e408]
                  - button "3W, e15, triple word, empty" [disabled] [ref=e409]:
                    - generic [ref=e410]: 3W
                  - button "f15, empty" [disabled] [ref=e411]
                  - button "g15, empty" [disabled] [ref=e412]
                  - button "2L, h15, double letter, empty" [disabled] [ref=e413]:
                    - generic [ref=e414]: 2L
                  - button "i15, empty" [disabled] [ref=e415]
                  - button "j15, empty" [disabled] [ref=e416]
                  - button "3W, k15, triple word, empty" [disabled] [ref=e417]:
                    - generic [ref=e418]: 3W
                  - button "l15, empty" [disabled] [ref=e419]
                  - button "m15, empty" [disabled] [ref=e420]
                  - button "n15, empty" [disabled] [ref=e421]
                  - button "2L, o15, double letter, empty" [disabled] [ref=e422]:
                    - generic [ref=e423]: 2L
          - status [ref=e425]:
            - generic [ref=e426]:
              - generic [ref=e427]: "Amber: avery. Teal: jordan_plays. Violet: morgan. Coral: robin_42."
              - text: Violet — to play · 67 tiles in the bag
        - button "History and stats" [ref=e431] [cursor=pointer]:
          - generic [ref=e433]:
            - paragraph [ref=e434]: History and stats
            - img [ref=e437]
      - generic [ref=e439]:
        - img [ref=e442]
        - generic [ref=e445]:
          - paragraph [ref=e446]: You're watching
          - paragraph [ref=e447]: Moves appear as they are played.
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