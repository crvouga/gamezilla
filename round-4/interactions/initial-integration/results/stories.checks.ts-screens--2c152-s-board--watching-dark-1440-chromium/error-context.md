# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--watching dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  50881 pixels (ratio 0.05 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/watching-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/watching-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 50881 pixels (ratio 0.05 of all image pixels) are different.
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
  - 50881 pixels (ratio 0.05 of all image pixels) are different.

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
          - generic [ref=e29]:
            - generic [ref=e33]:
              - generic [ref=e34]:
                - img "Teal" [ref=e35]
                - generic [ref=e36]: jordan_plays
              - generic [ref=e39]: 7 tiles
            - generic [ref=e40]:
              - generic [ref=e41]: Score
              - generic [ref=e42]: "3"
          - generic [ref=e44]:
            - paragraph [ref=e45]: You are watching. Racks stay private to their players.
            - generic [ref=e46]:
              - generic [ref=e47]:
                - button "Fit board" [pressed] [ref=e48] [cursor=pointer]:
                  - paragraph [ref=e51]: Fit board
                - button "Enlarge board" [ref=e52] [cursor=pointer]:
                  - paragraph [ref=e55]: Enlarge board
              - region "Scrollable word board" [ref=e57]:
                - group "Word board, fifteen columns and fifteen rows" [ref=e58]:
                  - generic [ref=e60]: a
                  - generic [ref=e61]: b
                  - generic [ref=e62]: c
                  - generic [ref=e63]: d
                  - generic [ref=e64]: e
                  - generic [ref=e65]: f
                  - generic [ref=e66]: g
                  - generic [ref=e67]: h
                  - generic [ref=e68]: i
                  - generic [ref=e69]: j
                  - generic [ref=e70]: k
                  - generic [ref=e71]: l
                  - generic [ref=e72]: m
                  - generic [ref=e73]: "n"
                  - generic [ref=e74]: o
                  - generic [ref=e75]: "1"
                  - button "2L, a1, double letter, empty" [disabled] [ref=e76]:
                    - generic [ref=e77]: 2L
                  - button "b1, empty" [disabled] [ref=e78]
                  - button "c1, empty" [disabled] [ref=e79]
                  - button "d1, empty" [disabled] [ref=e80]
                  - button "3W, e1, triple word, empty" [disabled] [ref=e81]:
                    - generic [ref=e82]: 3W
                  - button "f1, empty" [disabled] [ref=e83]
                  - button "g1, empty" [disabled] [ref=e84]
                  - button "2L, h1, double letter, empty" [disabled] [ref=e85]:
                    - generic [ref=e86]: 2L
                  - button "i1, empty" [disabled] [ref=e87]
                  - button "j1, empty" [disabled] [ref=e88]
                  - button "3W, k1, triple word, empty" [disabled] [ref=e89]:
                    - generic [ref=e90]: 3W
                  - button "l1, empty" [disabled] [ref=e91]
                  - button "m1, empty" [disabled] [ref=e92]
                  - button "n1, empty" [disabled] [ref=e93]
                  - button "2L, o1, double letter, empty" [disabled] [ref=e94]:
                    - generic [ref=e95]: 2L
                  - generic [ref=e96]: "2"
                  - button "a2, empty" [disabled] [ref=e97]
                  - button "b2, empty" [disabled] [ref=e98]
                  - button "c2, empty" [disabled] [ref=e99]
                  - button "2L, d2, double letter, empty" [disabled] [ref=e100]:
                    - generic [ref=e101]: 2L
                  - button "e2, empty" [disabled] [ref=e102]
                  - button "f2, empty" [disabled] [ref=e103]
                  - button "2W, g2, double word, empty" [disabled] [ref=e104]:
                    - generic [ref=e105]: 2W
                  - button "h2, empty" [disabled] [ref=e106]
                  - button "2W, i2, double word, empty" [disabled] [ref=e107]:
                    - generic [ref=e108]: 2W
                  - button "j2, empty" [disabled] [ref=e109]
                  - button "k2, empty" [disabled] [ref=e110]
                  - button "2L, l2, double letter, empty" [disabled] [ref=e111]:
                    - generic [ref=e112]: 2L
                  - button "m2, empty" [disabled] [ref=e113]
                  - button "n2, empty" [disabled] [ref=e114]
                  - button "o2, empty" [disabled] [ref=e115]
                  - generic [ref=e116]: "3"
                  - button "a3, empty" [disabled] [ref=e117]
                  - button "b3, empty" [disabled] [ref=e118]
                  - button "c3, empty" [disabled] [ref=e119]
                  - button "d3, empty" [disabled] [ref=e120]
                  - button "3L, e3, triple letter, empty" [disabled] [ref=e121]:
                    - generic [ref=e122]: 3L
                  - button "f3, empty" [disabled] [ref=e123]
                  - button "g3, empty" [disabled] [ref=e124]
                  - button "h3, empty" [disabled] [ref=e125]
                  - button "i3, empty" [disabled] [ref=e126]
                  - button "j3, empty" [disabled] [ref=e127]
                  - button "3L, k3, triple letter, empty" [disabled] [ref=e128]:
                    - generic [ref=e129]: 3L
                  - button "l3, empty" [disabled] [ref=e130]
                  - button "m3, empty" [disabled] [ref=e131]
                  - button "n3, empty" [disabled] [ref=e132]
                  - button "o3, empty" [disabled] [ref=e133]
                  - generic [ref=e134]: "4"
                  - button "a4, empty" [disabled] [ref=e135]
                  - button "2L, b4, double letter, empty" [disabled] [ref=e136]:
                    - generic [ref=e137]: 2L
                  - button "c4, empty" [disabled] [ref=e138]
                  - button "2W, d4, double word, empty" [disabled] [ref=e139]:
                    - generic [ref=e140]: 2W
                  - button "e4, empty" [disabled] [ref=e141]
                  - button "f4, empty" [disabled] [ref=e142]
                  - button "g4, empty" [disabled] [ref=e143]
                  - button "h4, empty" [disabled] [ref=e144]
                  - button "i4, empty" [disabled] [ref=e145]
                  - button "j4, empty" [disabled] [ref=e146]
                  - button "k4, empty" [disabled] [ref=e147]
                  - button "2W, l4, double word, empty" [disabled] [ref=e148]:
                    - generic [ref=e149]: 2W
                  - button "m4, empty" [disabled] [ref=e150]
                  - button "2L, n4, double letter, empty" [disabled] [ref=e151]:
                    - generic [ref=e152]: 2L
                  - button "o4, empty" [disabled] [ref=e153]
                  - generic [ref=e154]: "5"
                  - button "3W, a5, triple word, empty" [disabled] [ref=e155]:
                    - generic [ref=e156]: 3W
                  - button "b5, empty" [disabled] [ref=e157]
                  - button "3L, c5, triple letter, empty" [disabled] [ref=e158]:
                    - generic [ref=e159]: 3L
                  - button "d5, empty" [disabled] [ref=e160]
                  - button "e5, empty" [disabled] [ref=e161]
                  - button "f5, empty" [disabled] [ref=e162]
                  - button "2L, g5, double letter, empty" [disabled] [ref=e163]:
                    - generic [ref=e164]: 2L
                  - button "h5, empty" [disabled] [ref=e165]
                  - button "2L, i5, double letter, empty" [disabled] [ref=e166]:
                    - generic [ref=e167]: 2L
                  - button "j5, empty" [disabled] [ref=e168]
                  - button "k5, empty" [disabled] [ref=e169]
                  - button "l5, empty" [disabled] [ref=e170]
                  - button "3L, m5, triple letter, empty" [disabled] [ref=e171]:
                    - generic [ref=e172]: 3L
                  - button "n5, empty" [disabled] [ref=e173]
                  - button "3W, o5, triple word, empty" [disabled] [ref=e174]:
                    - generic [ref=e175]: 3W
                  - generic [ref=e176]: "6"
                  - button "a6, empty" [disabled] [ref=e177]
                  - button "b6, empty" [disabled] [ref=e178]
                  - button "c6, empty" [disabled] [ref=e179]
                  - button "d6, empty" [disabled] [ref=e180]
                  - button "e6, empty" [disabled] [ref=e181]
                  - button "f6, empty" [disabled] [ref=e182]
                  - button "g6, empty" [disabled] [ref=e183]
                  - button "3L, h6, triple letter, empty" [disabled] [ref=e184]:
                    - generic [ref=e185]: 3L
                  - button "i6, empty" [disabled] [ref=e186]
                  - button "j6, empty" [disabled] [ref=e187]
                  - button "k6, empty" [disabled] [ref=e188]
                  - button "l6, empty" [disabled] [ref=e189]
                  - button "m6, empty" [disabled] [ref=e190]
                  - button "n6, empty" [disabled] [ref=e191]
                  - button "o6, empty" [disabled] [ref=e192]
                  - generic [ref=e193]: "7"
                  - button "a7, empty" [disabled] [ref=e194]
                  - button "2W, b7, double word, empty" [disabled] [ref=e195]:
                    - generic [ref=e196]: 2W
                  - button "c7, empty" [disabled] [ref=e197]
                  - button "d7, empty" [disabled] [ref=e198]
                  - button "2L, e7, double letter, empty" [disabled] [ref=e199]:
                    - generic [ref=e200]: 2L
                  - button "f7, empty" [disabled] [ref=e201]
                  - button "2L, g7, double letter, empty" [disabled] [ref=e202]:
                    - generic [ref=e203]: 2L
                  - button "h7, empty" [disabled] [ref=e204]
                  - button "2L, i7, double letter, empty" [disabled] [ref=e205]:
                    - generic [ref=e206]: 2L
                  - button "j7, empty" [disabled] [ref=e207]
                  - button "2L, k7, double letter, empty" [disabled] [ref=e208]:
                    - generic [ref=e209]: 2L
                  - button "l7, empty" [disabled] [ref=e210]
                  - button "m7, empty" [disabled] [ref=e211]
                  - button "2W, n7, double word, empty" [disabled] [ref=e212]:
                    - generic [ref=e213]: 2W
                  - button "o7, empty" [disabled] [ref=e214]
                  - generic [ref=e215]: "8"
                  - button "2L, a8, double letter, empty" [disabled] [ref=e216]:
                    - generic [ref=e217]: 2L
                  - button "b8, empty" [disabled] [ref=e218]
                  - button "c8, empty" [disabled] [ref=e219]
                  - button "d8, empty" [disabled] [ref=e220]
                  - button "e8, empty" [disabled] [ref=e221]
                  - button "3L, f8, triple letter, empty" [disabled] [ref=e222]:
                    - generic [ref=e223]: 3L
                  - button "C 3, g8, committed" [disabled] [ref=e224]:
                    - generic [ref=e225]: C
                    - generic [ref=e226]: "3"
                  - button "A 1, h8, committed" [disabled] [ref=e227]:
                    - generic [ref=e228]: A
                    - generic [ref=e229]: "1"
                  - button "T 1, i8, committed" [disabled] [ref=e230]:
                    - generic [ref=e231]: T
                    - generic [ref=e232]: "1"
                  - button "3L, j8, triple letter, empty" [disabled] [ref=e233]:
                    - generic [ref=e234]: 3L
                  - button "k8, empty" [disabled] [ref=e235]
                  - button "l8, empty" [disabled] [ref=e236]
                  - button "m8, empty" [disabled] [ref=e237]
                  - button "n8, empty" [disabled] [ref=e238]
                  - button "2L, o8, double letter, empty" [disabled] [ref=e239]:
                    - generic [ref=e240]: 2L
                  - generic [ref=e241]: "9"
                  - button "a9, empty" [disabled] [ref=e242]
                  - button "2W, b9, double word, empty" [disabled] [ref=e243]:
                    - generic [ref=e244]: 2W
                  - button "c9, empty" [disabled] [ref=e245]
                  - button "d9, empty" [disabled] [ref=e246]
                  - button "2L, e9, double letter, empty" [disabled] [ref=e247]:
                    - generic [ref=e248]: 2L
                  - button "f9, empty" [disabled] [ref=e249]
                  - button "2L, g9, double letter, empty" [disabled] [ref=e250]:
                    - generic [ref=e251]: 2L
                  - button "h9, empty" [disabled] [ref=e252]
                  - button "O 1, i9, committed" [disabled] [ref=e253]:
                    - generic [ref=e254]: O
                    - generic [ref=e255]: "1"
                  - button "j9, empty" [disabled] [ref=e256]
                  - button "2L, k9, double letter, empty" [disabled] [ref=e257]:
                    - generic [ref=e258]: 2L
                  - button "l9, empty" [disabled] [ref=e259]
                  - button "m9, empty" [disabled] [ref=e260]
                  - button "2W, n9, double word, empty" [disabled] [ref=e261]:
                    - generic [ref=e262]: 2W
                  - button "o9, empty" [disabled] [ref=e263]
                  - generic [ref=e264]: "10"
                  - button "a10, empty" [disabled] [ref=e265]
                  - button "b10, empty" [disabled] [ref=e266]
                  - button "c10, empty" [disabled] [ref=e267]
                  - button "d10, empty" [disabled] [ref=e268]
                  - button "e10, empty" [disabled] [ref=e269]
                  - button "f10, empty" [disabled] [ref=e270]
                  - button "g10, empty" [disabled] [ref=e271]
                  - button "3L, h10, triple letter, empty" [disabled] [ref=e272]:
                    - generic [ref=e273]: 3L
                  - button "E 1, i10, committed" [disabled] [ref=e274]:
                    - generic [ref=e275]: E
                    - generic [ref=e276]: "1"
                  - button "j10, empty" [disabled] [ref=e277]
                  - button "k10, empty" [disabled] [ref=e278]
                  - button "l10, empty" [disabled] [ref=e279]
                  - button "m10, empty" [disabled] [ref=e280]
                  - button "n10, empty" [disabled] [ref=e281]
                  - button "o10, empty" [disabled] [ref=e282]
                  - generic [ref=e283]: "11"
                  - button "3W, a11, triple word, empty" [disabled] [ref=e284]:
                    - generic [ref=e285]: 3W
                  - button "b11, empty" [disabled] [ref=e286]
                  - button "3L, c11, triple letter, empty" [disabled] [ref=e287]:
                    - generic [ref=e288]: 3L
                  - button "d11, empty" [disabled] [ref=e289]
                  - button "e11, empty" [disabled] [ref=e290]
                  - button "f11, empty" [disabled] [ref=e291]
                  - button "2L, g11, double letter, empty" [disabled] [ref=e292]:
                    - generic [ref=e293]: 2L
                  - button "h11, empty" [disabled] [ref=e294]
                  - button "2L, i11, double letter, empty" [disabled] [ref=e295]:
                    - generic [ref=e296]: 2L
                  - button "j11, empty" [disabled] [ref=e297]
                  - button "k11, empty" [disabled] [ref=e298]
                  - button "l11, empty" [disabled] [ref=e299]
                  - button "3L, m11, triple letter, empty" [disabled] [ref=e300]:
                    - generic [ref=e301]: 3L
                  - button "n11, empty" [disabled] [ref=e302]
                  - button "3W, o11, triple word, empty" [disabled] [ref=e303]:
                    - generic [ref=e304]: 3W
                  - generic [ref=e305]: "12"
                  - button "a12, empty" [disabled] [ref=e306]
                  - button "2L, b12, double letter, empty" [disabled] [ref=e307]:
                    - generic [ref=e308]: 2L
                  - button "c12, empty" [disabled] [ref=e309]
                  - button "2W, d12, double word, empty" [disabled] [ref=e310]:
                    - generic [ref=e311]: 2W
                  - button "e12, empty" [disabled] [ref=e312]
                  - button "f12, empty" [disabled] [ref=e313]
                  - button "g12, empty" [disabled] [ref=e314]
                  - button "h12, empty" [disabled] [ref=e315]
                  - button "i12, empty" [disabled] [ref=e316]
                  - button "j12, empty" [disabled] [ref=e317]
                  - button "k12, empty" [disabled] [ref=e318]
                  - button "2W, l12, double word, empty" [disabled] [ref=e319]:
                    - generic [ref=e320]: 2W
                  - button "m12, empty" [disabled] [ref=e321]
                  - button "2L, n12, double letter, empty" [disabled] [ref=e322]:
                    - generic [ref=e323]: 2L
                  - button "o12, empty" [disabled] [ref=e324]
                  - generic [ref=e325]: "13"
                  - button "a13, empty" [disabled] [ref=e326]
                  - button "b13, empty" [disabled] [ref=e327]
                  - button "c13, empty" [disabled] [ref=e328]
                  - button "d13, empty" [disabled] [ref=e329]
                  - button "3L, e13, triple letter, empty" [disabled] [ref=e330]:
                    - generic [ref=e331]: 3L
                  - button "f13, empty" [disabled] [ref=e332]
                  - button "g13, empty" [disabled] [ref=e333]
                  - button "h13, empty" [disabled] [ref=e334]
                  - button "i13, empty" [disabled] [ref=e335]
                  - button "j13, empty" [disabled] [ref=e336]
                  - button "3L, k13, triple letter, empty" [disabled] [ref=e337]:
                    - generic [ref=e338]: 3L
                  - button "l13, empty" [disabled] [ref=e339]
                  - button "m13, empty" [disabled] [ref=e340]
                  - button "n13, empty" [disabled] [ref=e341]
                  - button "o13, empty" [disabled] [ref=e342]
                  - generic [ref=e343]: "14"
                  - button "a14, empty" [disabled] [ref=e344]
                  - button "b14, empty" [disabled] [ref=e345]
                  - button "c14, empty" [disabled] [ref=e346]
                  - button "2L, d14, double letter, empty" [disabled] [ref=e347]:
                    - generic [ref=e348]: 2L
                  - button "e14, empty" [disabled] [ref=e349]
                  - button "f14, empty" [disabled] [ref=e350]
                  - button "2W, g14, double word, empty" [disabled] [ref=e351]:
                    - generic [ref=e352]: 2W
                  - button "h14, empty" [disabled] [ref=e353]
                  - button "2W, i14, double word, empty" [disabled] [ref=e354]:
                    - generic [ref=e355]: 2W
                  - button "j14, empty" [disabled] [ref=e356]
                  - button "k14, empty" [disabled] [ref=e357]
                  - button "2L, l14, double letter, empty" [disabled] [ref=e358]:
                    - generic [ref=e359]: 2L
                  - button "m14, empty" [disabled] [ref=e360]
                  - button "n14, empty" [disabled] [ref=e361]
                  - button "o14, empty" [disabled] [ref=e362]
                  - generic [ref=e363]: "15"
                  - button "2L, a15, double letter, empty" [disabled] [ref=e364]:
                    - generic [ref=e365]: 2L
                  - button "b15, empty" [disabled] [ref=e366]
                  - button "c15, empty" [disabled] [ref=e367]
                  - button "d15, empty" [disabled] [ref=e368]
                  - button "3W, e15, triple word, empty" [disabled] [ref=e369]:
                    - generic [ref=e370]: 3W
                  - button "f15, empty" [disabled] [ref=e371]
                  - button "g15, empty" [disabled] [ref=e372]
                  - button "2L, h15, double letter, empty" [disabled] [ref=e373]:
                    - generic [ref=e374]: 2L
                  - button "i15, empty" [disabled] [ref=e375]
                  - button "j15, empty" [disabled] [ref=e376]
                  - button "3W, k15, triple word, empty" [disabled] [ref=e377]:
                    - generic [ref=e378]: 3W
                  - button "l15, empty" [disabled] [ref=e379]
                  - button "m15, empty" [disabled] [ref=e380]
                  - button "n15, empty" [disabled] [ref=e381]
                  - button "2L, o15, double letter, empty" [disabled] [ref=e382]:
                    - generic [ref=e383]: 2L
          - status [ref=e385]:
            - generic [ref=e386]:
              - generic [ref=e387]: "Amber: avery. Teal: jordan_plays."
              - text: Amber — to play · 81 tiles in the bag
          - generic [ref=e390]:
            - generic [ref=e394]:
              - generic [ref=e395]:
                - img "Amber" [ref=e396]
                - generic [ref=e397]: avery
                - generic [ref=e398]: To move
              - generic [ref=e401]: 7 tiles
            - generic [ref=e402]:
              - generic [ref=e403]: Score
              - generic [ref=e404]: "10"
        - region "Game record" [ref=e407]:
          - generic [ref=e408]:
            - heading "Game record" [level=2] [ref=e410]
            - paragraph [ref=e411]: Amber — to play · 81 tiles in the bag
          - button "History and stats" [ref=e414] [cursor=pointer]:
            - paragraph [ref=e417]: History and stats
      - generic [ref=e418]:
        - img [ref=e421]
        - generic [ref=e424]:
          - paragraph [ref=e425]: You're watching
          - paragraph [ref=e426]: Moves appear as they are played.
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