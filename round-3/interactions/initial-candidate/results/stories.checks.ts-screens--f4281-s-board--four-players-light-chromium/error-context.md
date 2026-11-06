# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--four-players light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  40590 pixels (ratio 0.13 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/four-players-light.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/four-players-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 40590 pixels (ratio 0.13 of all image pixels) are different.
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
  - 40590 pixels (ratio 0.13 of all image pixels) are different.

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
              - region "Scrollable word board" [ref=e101]:
                - group "Word board, fifteen columns and fifteen rows" [ref=e102]:
                  - generic [ref=e104]: a
                  - generic [ref=e105]: b
                  - generic [ref=e106]: c
                  - generic [ref=e107]: d
                  - generic [ref=e108]: e
                  - generic [ref=e109]: f
                  - generic [ref=e110]: g
                  - generic [ref=e111]: h
                  - generic [ref=e112]: i
                  - generic [ref=e113]: j
                  - generic [ref=e114]: k
                  - generic [ref=e115]: l
                  - generic [ref=e116]: m
                  - generic [ref=e117]: "n"
                  - generic [ref=e118]: o
                  - generic [ref=e119]: "1"
                  - button "2L, a1, double letter, empty" [disabled] [ref=e120]:
                    - generic [ref=e121]: 2L
                  - button "b1, empty" [disabled] [ref=e122]
                  - button "c1, empty" [disabled] [ref=e123]
                  - button "d1, empty" [disabled] [ref=e124]
                  - button "3W, e1, triple word, empty" [disabled] [ref=e125]:
                    - generic [ref=e126]: 3W
                  - button "f1, empty" [disabled] [ref=e127]
                  - button "g1, empty" [disabled] [ref=e128]
                  - button "2L, h1, double letter, empty" [disabled] [ref=e129]:
                    - generic [ref=e130]: 2L
                  - button "i1, empty" [disabled] [ref=e131]
                  - button "j1, empty" [disabled] [ref=e132]
                  - button "3W, k1, triple word, empty" [disabled] [ref=e133]:
                    - generic [ref=e134]: 3W
                  - button "l1, empty" [disabled] [ref=e135]
                  - button "m1, empty" [disabled] [ref=e136]
                  - button "n1, empty" [disabled] [ref=e137]
                  - button "2L, o1, double letter, empty" [disabled] [ref=e138]:
                    - generic [ref=e139]: 2L
                  - generic [ref=e140]: "2"
                  - button "a2, empty" [disabled] [ref=e141]
                  - button "b2, empty" [disabled] [ref=e142]
                  - button "c2, empty" [disabled] [ref=e143]
                  - button "2L, d2, double letter, empty" [disabled] [ref=e144]:
                    - generic [ref=e145]: 2L
                  - button "e2, empty" [disabled] [ref=e146]
                  - button "f2, empty" [disabled] [ref=e147]
                  - button "2W, g2, double word, empty" [disabled] [ref=e148]:
                    - generic [ref=e149]: 2W
                  - button "h2, empty" [disabled] [ref=e150]
                  - button "2W, i2, double word, empty" [disabled] [ref=e151]:
                    - generic [ref=e152]: 2W
                  - button "j2, empty" [disabled] [ref=e153]
                  - button "k2, empty" [disabled] [ref=e154]
                  - button "2L, l2, double letter, empty" [disabled] [ref=e155]:
                    - generic [ref=e156]: 2L
                  - button "m2, empty" [disabled] [ref=e157]
                  - button "n2, empty" [disabled] [ref=e158]
                  - button "o2, empty" [disabled] [ref=e159]
                  - generic [ref=e160]: "3"
                  - button "a3, empty" [disabled] [ref=e161]
                  - button "b3, empty" [disabled] [ref=e162]
                  - button "c3, empty" [disabled] [ref=e163]
                  - button "d3, empty" [disabled] [ref=e164]
                  - button "3L, e3, triple letter, empty" [disabled] [ref=e165]:
                    - generic [ref=e166]: 3L
                  - button "f3, empty" [disabled] [ref=e167]
                  - button "g3, empty" [disabled] [ref=e168]
                  - button "h3, empty" [disabled] [ref=e169]
                  - button "i3, empty" [disabled] [ref=e170]
                  - button "j3, empty" [disabled] [ref=e171]
                  - button "3L, k3, triple letter, empty" [disabled] [ref=e172]:
                    - generic [ref=e173]: 3L
                  - button "l3, empty" [disabled] [ref=e174]
                  - button "m3, empty" [disabled] [ref=e175]
                  - button "n3, empty" [disabled] [ref=e176]
                  - button "o3, empty" [disabled] [ref=e177]
                  - generic [ref=e178]: "4"
                  - button "a4, empty" [disabled] [ref=e179]
                  - button "2L, b4, double letter, empty" [disabled] [ref=e180]:
                    - generic [ref=e181]: 2L
                  - button "c4, empty" [disabled] [ref=e182]
                  - button "2W, d4, double word, empty" [disabled] [ref=e183]:
                    - generic [ref=e184]: 2W
                  - button "e4, empty" [disabled] [ref=e185]
                  - button "f4, empty" [disabled] [ref=e186]
                  - button "g4, empty" [disabled] [ref=e187]
                  - button "h4, empty" [disabled] [ref=e188]
                  - button "i4, empty" [disabled] [ref=e189]
                  - button "j4, empty" [disabled] [ref=e190]
                  - button "k4, empty" [disabled] [ref=e191]
                  - button "2W, l4, double word, empty" [disabled] [ref=e192]:
                    - generic [ref=e193]: 2W
                  - button "m4, empty" [disabled] [ref=e194]
                  - button "2L, n4, double letter, empty" [disabled] [ref=e195]:
                    - generic [ref=e196]: 2L
                  - button "o4, empty" [disabled] [ref=e197]
                  - generic [ref=e198]: "5"
                  - button "3W, a5, triple word, empty" [disabled] [ref=e199]:
                    - generic [ref=e200]: 3W
                  - button "b5, empty" [disabled] [ref=e201]
                  - button "3L, c5, triple letter, empty" [disabled] [ref=e202]:
                    - generic [ref=e203]: 3L
                  - button "d5, empty" [disabled] [ref=e204]
                  - button "e5, empty" [disabled] [ref=e205]
                  - button "f5, empty" [disabled] [ref=e206]
                  - button "2L, g5, double letter, empty" [disabled] [ref=e207]:
                    - generic [ref=e208]: 2L
                  - button "h5, empty" [disabled] [ref=e209]
                  - button "2L, i5, double letter, empty" [disabled] [ref=e210]:
                    - generic [ref=e211]: 2L
                  - button "j5, empty" [disabled] [ref=e212]
                  - button "k5, empty" [disabled] [ref=e213]
                  - button "l5, empty" [disabled] [ref=e214]
                  - button "3L, m5, triple letter, empty" [disabled] [ref=e215]:
                    - generic [ref=e216]: 3L
                  - button "n5, empty" [disabled] [ref=e217]
                  - button "3W, o5, triple word, empty" [disabled] [ref=e218]:
                    - generic [ref=e219]: 3W
                  - generic [ref=e220]: "6"
                  - button "a6, empty" [disabled] [ref=e221]
                  - button "b6, empty" [disabled] [ref=e222]
                  - button "c6, empty" [disabled] [ref=e223]
                  - button "d6, empty" [disabled] [ref=e224]
                  - button "e6, empty" [disabled] [ref=e225]
                  - button "f6, empty" [disabled] [ref=e226]
                  - button "g6, empty" [disabled] [ref=e227]
                  - button "3L, h6, triple letter, empty" [disabled] [ref=e228]:
                    - generic [ref=e229]: 3L
                  - button "i6, empty" [disabled] [ref=e230]
                  - button "j6, empty" [disabled] [ref=e231]
                  - button "k6, empty" [disabled] [ref=e232]
                  - button "l6, empty" [disabled] [ref=e233]
                  - button "m6, empty" [disabled] [ref=e234]
                  - button "n6, empty" [disabled] [ref=e235]
                  - button "o6, empty" [disabled] [ref=e236]
                  - generic [ref=e237]: "7"
                  - button "a7, empty" [disabled] [ref=e238]
                  - button "2W, b7, double word, empty" [disabled] [ref=e239]:
                    - generic [ref=e240]: 2W
                  - button "c7, empty" [disabled] [ref=e241]
                  - button "d7, empty" [disabled] [ref=e242]
                  - button "2L, e7, double letter, empty" [disabled] [ref=e243]:
                    - generic [ref=e244]: 2L
                  - button "f7, empty" [disabled] [ref=e245]
                  - button "2L, g7, double letter, empty" [disabled] [ref=e246]:
                    - generic [ref=e247]: 2L
                  - button "h7, empty" [disabled] [ref=e248]
                  - button "2L, i7, double letter, empty" [disabled] [ref=e249]:
                    - generic [ref=e250]: 2L
                  - button "j7, empty" [disabled] [ref=e251]
                  - button "2L, k7, double letter, empty" [disabled] [ref=e252]:
                    - generic [ref=e253]: 2L
                  - button "l7, empty" [disabled] [ref=e254]
                  - button "m7, empty" [disabled] [ref=e255]
                  - button "2W, n7, double word, empty" [disabled] [ref=e256]:
                    - generic [ref=e257]: 2W
                  - button "o7, empty" [disabled] [ref=e258]
                  - generic [ref=e259]: "8"
                  - button "2L, a8, double letter, empty" [disabled] [ref=e260]:
                    - generic [ref=e261]: 2L
                  - button "b8, empty" [disabled] [ref=e262]
                  - button "c8, empty" [disabled] [ref=e263]
                  - button "d8, empty" [disabled] [ref=e264]
                  - button "e8, empty" [disabled] [ref=e265]
                  - button "3L, f8, triple letter, empty" [disabled] [ref=e266]:
                    - generic [ref=e267]: 3L
                  - button "C 3, g8, committed" [disabled] [ref=e268]:
                    - generic [ref=e269]: C
                  - button "A 1, h8, committed" [disabled] [ref=e270]:
                    - generic [ref=e271]: A
                  - button "T 1, i8, committed" [disabled] [ref=e272]:
                    - generic [ref=e273]: T
                  - button "3L, j8, triple letter, empty" [disabled] [ref=e274]:
                    - generic [ref=e275]: 3L
                  - button "k8, empty" [disabled] [ref=e276]
                  - button "l8, empty" [disabled] [ref=e277]
                  - button "m8, empty" [disabled] [ref=e278]
                  - button "n8, empty" [disabled] [ref=e279]
                  - button "2L, o8, double letter, empty" [disabled] [ref=e280]:
                    - generic [ref=e281]: 2L
                  - generic [ref=e282]: "9"
                  - button "a9, empty" [disabled] [ref=e283]
                  - button "2W, b9, double word, empty" [disabled] [ref=e284]:
                    - generic [ref=e285]: 2W
                  - button "c9, empty" [disabled] [ref=e286]
                  - button "d9, empty" [disabled] [ref=e287]
                  - button "2L, e9, double letter, empty" [disabled] [ref=e288]:
                    - generic [ref=e289]: 2L
                  - button "f9, empty" [disabled] [ref=e290]
                  - button "2L, g9, double letter, empty" [disabled] [ref=e291]:
                    - generic [ref=e292]: 2L
                  - button "h9, empty" [disabled] [ref=e293]
                  - button "O 1, i9, committed" [disabled] [ref=e294]:
                    - generic [ref=e295]: O
                  - button "j9, empty" [disabled] [ref=e296]
                  - button "2L, k9, double letter, empty" [disabled] [ref=e297]:
                    - generic [ref=e298]: 2L
                  - button "l9, empty" [disabled] [ref=e299]
                  - button "m9, empty" [disabled] [ref=e300]
                  - button "2W, n9, double word, empty" [disabled] [ref=e301]:
                    - generic [ref=e302]: 2W
                  - button "o9, empty" [disabled] [ref=e303]
                  - generic [ref=e304]: "10"
                  - button "a10, empty" [disabled] [ref=e305]
                  - button "b10, empty" [disabled] [ref=e306]
                  - button "c10, empty" [disabled] [ref=e307]
                  - button "d10, empty" [disabled] [ref=e308]
                  - button "e10, empty" [disabled] [ref=e309]
                  - button "f10, empty" [disabled] [ref=e310]
                  - button "g10, empty" [disabled] [ref=e311]
                  - button "3L, h10, triple letter, empty" [disabled] [ref=e312]:
                    - generic [ref=e313]: 3L
                  - button "E 1, i10, committed" [disabled] [ref=e314]:
                    - generic [ref=e315]: E
                  - button "j10, empty" [disabled] [ref=e316]
                  - button "k10, empty" [disabled] [ref=e317]
                  - button "l10, empty" [disabled] [ref=e318]
                  - button "m10, empty" [disabled] [ref=e319]
                  - button "n10, empty" [disabled] [ref=e320]
                  - button "o10, empty" [disabled] [ref=e321]
                  - generic [ref=e322]: "11"
                  - button "3W, a11, triple word, empty" [disabled] [ref=e323]:
                    - generic [ref=e324]: 3W
                  - button "b11, empty" [disabled] [ref=e325]
                  - button "3L, c11, triple letter, empty" [disabled] [ref=e326]:
                    - generic [ref=e327]: 3L
                  - button "d11, empty" [disabled] [ref=e328]
                  - button "e11, empty" [disabled] [ref=e329]
                  - button "f11, empty" [disabled] [ref=e330]
                  - button "2L, g11, double letter, empty" [disabled] [ref=e331]:
                    - generic [ref=e332]: 2L
                  - button "h11, empty" [disabled] [ref=e333]
                  - button "2L, i11, double letter, empty" [disabled] [ref=e334]:
                    - generic [ref=e335]: 2L
                  - button "j11, empty" [disabled] [ref=e336]
                  - button "k11, empty" [disabled] [ref=e337]
                  - button "l11, empty" [disabled] [ref=e338]
                  - button "3L, m11, triple letter, empty" [disabled] [ref=e339]:
                    - generic [ref=e340]: 3L
                  - button "n11, empty" [disabled] [ref=e341]
                  - button "3W, o11, triple word, empty" [disabled] [ref=e342]:
                    - generic [ref=e343]: 3W
                  - generic [ref=e344]: "12"
                  - button "a12, empty" [disabled] [ref=e345]
                  - button "2L, b12, double letter, empty" [disabled] [ref=e346]:
                    - generic [ref=e347]: 2L
                  - button "c12, empty" [disabled] [ref=e348]
                  - button "2W, d12, double word, empty" [disabled] [ref=e349]:
                    - generic [ref=e350]: 2W
                  - button "e12, empty" [disabled] [ref=e351]
                  - button "f12, empty" [disabled] [ref=e352]
                  - button "g12, empty" [disabled] [ref=e353]
                  - button "h12, empty" [disabled] [ref=e354]
                  - button "i12, empty" [disabled] [ref=e355]
                  - button "j12, empty" [disabled] [ref=e356]
                  - button "k12, empty" [disabled] [ref=e357]
                  - button "2W, l12, double word, empty" [disabled] [ref=e358]:
                    - generic [ref=e359]: 2W
                  - button "m12, empty" [disabled] [ref=e360]
                  - button "2L, n12, double letter, empty" [disabled] [ref=e361]:
                    - generic [ref=e362]: 2L
                  - button "o12, empty" [disabled] [ref=e363]
                  - generic [ref=e364]: "13"
                  - button "a13, empty" [disabled] [ref=e365]
                  - button "b13, empty" [disabled] [ref=e366]
                  - button "c13, empty" [disabled] [ref=e367]
                  - button "d13, empty" [disabled] [ref=e368]
                  - button "3L, e13, triple letter, empty" [disabled] [ref=e369]:
                    - generic [ref=e370]: 3L
                  - button "f13, empty" [disabled] [ref=e371]
                  - button "g13, empty" [disabled] [ref=e372]
                  - button "h13, empty" [disabled] [ref=e373]
                  - button "i13, empty" [disabled] [ref=e374]
                  - button "j13, empty" [disabled] [ref=e375]
                  - button "3L, k13, triple letter, empty" [disabled] [ref=e376]:
                    - generic [ref=e377]: 3L
                  - button "l13, empty" [disabled] [ref=e378]
                  - button "m13, empty" [disabled] [ref=e379]
                  - button "n13, empty" [disabled] [ref=e380]
                  - button "o13, empty" [disabled] [ref=e381]
                  - generic [ref=e382]: "14"
                  - button "a14, empty" [disabled] [ref=e383]
                  - button "b14, empty" [disabled] [ref=e384]
                  - button "c14, empty" [disabled] [ref=e385]
                  - button "2L, d14, double letter, empty" [disabled] [ref=e386]:
                    - generic [ref=e387]: 2L
                  - button "e14, empty" [disabled] [ref=e388]
                  - button "f14, empty" [disabled] [ref=e389]
                  - button "2W, g14, double word, empty" [disabled] [ref=e390]:
                    - generic [ref=e391]: 2W
                  - button "h14, empty" [disabled] [ref=e392]
                  - button "2W, i14, double word, empty" [disabled] [ref=e393]:
                    - generic [ref=e394]: 2W
                  - button "j14, empty" [disabled] [ref=e395]
                  - button "k14, empty" [disabled] [ref=e396]
                  - button "2L, l14, double letter, empty" [disabled] [ref=e397]:
                    - generic [ref=e398]: 2L
                  - button "m14, empty" [disabled] [ref=e399]
                  - button "n14, empty" [disabled] [ref=e400]
                  - button "o14, empty" [disabled] [ref=e401]
                  - generic [ref=e402]: "15"
                  - button "2L, a15, double letter, empty" [disabled] [ref=e403]:
                    - generic [ref=e404]: 2L
                  - button "b15, empty" [disabled] [ref=e405]
                  - button "c15, empty" [disabled] [ref=e406]
                  - button "d15, empty" [disabled] [ref=e407]
                  - button "3W, e15, triple word, empty" [disabled] [ref=e408]:
                    - generic [ref=e409]: 3W
                  - button "f15, empty" [disabled] [ref=e410]
                  - button "g15, empty" [disabled] [ref=e411]
                  - button "2L, h15, double letter, empty" [disabled] [ref=e412]:
                    - generic [ref=e413]: 2L
                  - button "i15, empty" [disabled] [ref=e414]
                  - button "j15, empty" [disabled] [ref=e415]
                  - button "3W, k15, triple word, empty" [disabled] [ref=e416]:
                    - generic [ref=e417]: 3W
                  - button "l15, empty" [disabled] [ref=e418]
                  - button "m15, empty" [disabled] [ref=e419]
                  - button "n15, empty" [disabled] [ref=e420]
                  - button "2L, o15, double letter, empty" [disabled] [ref=e421]:
                    - generic [ref=e422]: 2L
          - status [ref=e424]:
            - generic [ref=e425]:
              - generic [ref=e426]: "Amber: avery. Teal: jordan_plays. Violet: morgan. Coral: robin_42."
              - text: Violet — to play · 67 tiles in the bag
        - button "History and stats" [ref=e430] [cursor=pointer]:
          - generic [ref=e432]:
            - paragraph [ref=e433]: History and stats
            - img [ref=e436]
      - generic [ref=e438]:
        - img [ref=e441]
        - generic [ref=e444]:
          - paragraph [ref=e445]: You're watching
          - paragraph [ref=e446]: Moves appear as they are played.
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