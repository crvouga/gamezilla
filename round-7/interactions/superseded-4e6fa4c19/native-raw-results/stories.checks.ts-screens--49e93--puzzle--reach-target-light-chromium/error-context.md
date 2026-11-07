# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-puzzle--reach-target light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  95075 pixels (ratio 0.29 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-puzzle/reach-target-light.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-puzzle/reach-target-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 95075 pixels (ratio 0.29 of all image pixels) are different.
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
  - 95075 pixels (ratio 0.29 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e10]:
    - paragraph [ref=e11]: Score at least 6 points in one move.
    - status [ref=e12]: Your last move scored 8 of 6.
    - generic [ref=e13]:
      - img [ref=e16]
      - generic [ref=e19]:
        - status [ref=e20]: Target reached. Puzzle solved!
        - button "Puzzle library" [active] [ref=e21] [cursor=pointer]:
          - paragraph [ref=e24]: Puzzle library
    - paragraph [ref=e25]: "2L/3L: double/triple letter. 2W/3W: double/triple word."
    - generic [ref=e27]:
      - region "Scrollable word board" [ref=e28]:
        - group "Puzzle board, fifteen columns and fifteen rows" [ref=e29]:
          - generic [ref=e31]: a
          - generic [ref=e32]: b
          - generic [ref=e33]: c
          - generic [ref=e34]: d
          - generic [ref=e35]: e
          - generic [ref=e36]: f
          - generic [ref=e37]: g
          - generic [ref=e38]: h
          - generic [ref=e39]: i
          - generic [ref=e40]: j
          - generic [ref=e41]: k
          - generic [ref=e42]: l
          - generic [ref=e43]: m
          - generic [ref=e44]: "n"
          - generic [ref=e45]: o
          - generic [ref=e46]: "1"
          - button "2L, a1, double letter, empty" [disabled] [ref=e47]:
            - generic [ref=e48]: 2L
          - button "b1, empty" [disabled] [ref=e49]
          - button "c1, empty" [disabled] [ref=e50]
          - button "d1, empty" [disabled] [ref=e51]
          - button "3W, e1, triple word, empty" [disabled] [ref=e52]:
            - generic [ref=e53]: 3W
          - button "f1, empty" [disabled] [ref=e54]
          - button "g1, empty" [disabled] [ref=e55]
          - button "2L, h1, double letter, empty" [disabled] [ref=e56]:
            - generic [ref=e57]: 2L
          - button "i1, empty" [disabled] [ref=e58]
          - button "j1, empty" [disabled] [ref=e59]
          - button "3W, k1, triple word, empty" [disabled] [ref=e60]:
            - generic [ref=e61]: 3W
          - button "l1, empty" [disabled] [ref=e62]
          - button "m1, empty" [disabled] [ref=e63]
          - button "n1, empty" [disabled] [ref=e64]
          - button "2L, o1, double letter, empty" [disabled] [ref=e65]:
            - generic [ref=e66]: 2L
          - generic [ref=e67]: "2"
          - button "a2, empty" [disabled] [ref=e68]
          - button "b2, empty" [disabled] [ref=e69]
          - button "c2, empty" [disabled] [ref=e70]
          - button "2L, d2, double letter, empty" [disabled] [ref=e71]:
            - generic [ref=e72]: 2L
          - button "e2, empty" [disabled] [ref=e73]
          - button "f2, empty" [disabled] [ref=e74]
          - button "2W, g2, double word, empty" [disabled] [ref=e75]:
            - generic [ref=e76]: 2W
          - button "h2, empty" [disabled] [ref=e77]
          - button "2W, i2, double word, empty" [disabled] [ref=e78]:
            - generic [ref=e79]: 2W
          - button "j2, empty" [disabled] [ref=e80]
          - button "k2, empty" [disabled] [ref=e81]
          - button "2L, l2, double letter, empty" [disabled] [ref=e82]:
            - generic [ref=e83]: 2L
          - button "m2, empty" [disabled] [ref=e84]
          - button "n2, empty" [disabled] [ref=e85]
          - button "o2, empty" [disabled] [ref=e86]
          - generic [ref=e87]: "3"
          - button "a3, empty" [disabled] [ref=e88]
          - button "b3, empty" [disabled] [ref=e89]
          - button "c3, empty" [disabled] [ref=e90]
          - button "d3, empty" [disabled] [ref=e91]
          - button "3L, e3, triple letter, empty" [disabled] [ref=e92]:
            - generic [ref=e93]: 3L
          - button "f3, empty" [disabled] [ref=e94]
          - button "g3, empty" [disabled] [ref=e95]
          - button "h3, empty" [disabled] [ref=e96]
          - button "i3, empty" [disabled] [ref=e97]
          - button "j3, empty" [disabled] [ref=e98]
          - button "3L, k3, triple letter, empty" [disabled] [ref=e99]:
            - generic [ref=e100]: 3L
          - button "l3, empty" [disabled] [ref=e101]
          - button "m3, empty" [disabled] [ref=e102]
          - button "n3, empty" [disabled] [ref=e103]
          - button "o3, empty" [disabled] [ref=e104]
          - generic [ref=e105]: "4"
          - button "a4, empty" [disabled] [ref=e106]
          - button "2L, b4, double letter, empty" [disabled] [ref=e107]:
            - generic [ref=e108]: 2L
          - button "c4, empty" [disabled] [ref=e109]
          - button "2W, d4, double word, empty" [disabled] [ref=e110]:
            - generic [ref=e111]: 2W
          - button "e4, empty" [disabled] [ref=e112]
          - button "f4, empty" [disabled] [ref=e113]
          - button "g4, empty" [disabled] [ref=e114]
          - button "h4, empty" [disabled] [ref=e115]
          - button "i4, empty" [disabled] [ref=e116]
          - button "j4, empty" [disabled] [ref=e117]
          - button "k4, empty" [disabled] [ref=e118]
          - button "2W, l4, double word, empty" [disabled] [ref=e119]:
            - generic [ref=e120]: 2W
          - button "m4, empty" [disabled] [ref=e121]
          - button "2L, n4, double letter, empty" [disabled] [ref=e122]:
            - generic [ref=e123]: 2L
          - button "o4, empty" [disabled] [ref=e124]
          - generic [ref=e125]: "5"
          - button "3W, a5, triple word, empty" [disabled] [ref=e126]:
            - generic [ref=e127]: 3W
          - button "b5, empty" [disabled] [ref=e128]
          - button "3L, c5, triple letter, empty" [disabled] [ref=e129]:
            - generic [ref=e130]: 3L
          - button "d5, empty" [disabled] [ref=e131]
          - button "e5, empty" [disabled] [ref=e132]
          - button "f5, empty" [disabled] [ref=e133]
          - button "2L, g5, double letter, empty" [disabled] [ref=e134]:
            - generic [ref=e135]: 2L
          - button "h5, empty" [disabled] [ref=e136]
          - button "2L, i5, double letter, empty" [disabled] [ref=e137]:
            - generic [ref=e138]: 2L
          - button "j5, empty" [disabled] [ref=e139]
          - button "k5, empty" [disabled] [ref=e140]
          - button "l5, empty" [disabled] [ref=e141]
          - button "3L, m5, triple letter, empty" [disabled] [ref=e142]:
            - generic [ref=e143]: 3L
          - button "n5, empty" [disabled] [ref=e144]
          - button "3W, o5, triple word, empty" [disabled] [ref=e145]:
            - generic [ref=e146]: 3W
          - generic [ref=e147]: "6"
          - button "a6, empty" [disabled] [ref=e148]
          - button "b6, empty" [disabled] [ref=e149]
          - button "c6, empty" [disabled] [ref=e150]
          - button "d6, empty" [disabled] [ref=e151]
          - button "e6, empty" [disabled] [ref=e152]
          - button "f6, empty" [disabled] [ref=e153]
          - button "g6, empty" [disabled] [ref=e154]
          - button "3L, h6, triple letter, empty" [disabled] [ref=e155]:
            - generic [ref=e156]: 3L
          - button "i6, empty" [disabled] [ref=e157]
          - button "j6, empty" [disabled] [ref=e158]
          - button "k6, empty" [disabled] [ref=e159]
          - button "l6, empty" [disabled] [ref=e160]
          - button "m6, empty" [disabled] [ref=e161]
          - button "n6, empty" [disabled] [ref=e162]
          - button "o6, empty" [disabled] [ref=e163]
          - generic [ref=e164]: "7"
          - button "a7, empty" [disabled] [ref=e165]
          - button "2W, b7, double word, empty" [disabled] [ref=e166]:
            - generic [ref=e167]: 2W
          - button "c7, empty" [disabled] [ref=e168]
          - button "d7, empty" [disabled] [ref=e169]
          - button "2L, e7, double letter, empty" [disabled] [ref=e170]:
            - generic [ref=e171]: 2L
          - button "f7, empty" [disabled] [ref=e172]
          - button "2L, g7, double letter, empty" [disabled] [ref=e173]:
            - generic [ref=e174]: 2L
          - button "h7, empty" [disabled] [ref=e175]
          - button "2L, i7, double letter, empty" [disabled] [ref=e176]:
            - generic [ref=e177]: 2L
          - button "j7, empty" [disabled] [ref=e178]
          - button "2L, k7, double letter, empty" [disabled] [ref=e179]:
            - generic [ref=e180]: 2L
          - button "l7, empty" [disabled] [ref=e181]
          - button "m7, empty" [disabled] [ref=e182]
          - button "2W, n7, double word, empty" [disabled] [ref=e183]:
            - generic [ref=e184]: 2W
          - button "o7, empty" [disabled] [ref=e185]
          - generic [ref=e186]: "8"
          - button "2L, a8, double letter, empty" [disabled] [ref=e187]:
            - generic [ref=e188]: 2L
          - button "b8, empty" [disabled] [ref=e189]
          - button "c8, empty" [disabled] [ref=e190]
          - button "d8, empty" [disabled] [ref=e191]
          - button "e8, empty" [disabled] [ref=e192]
          - button "3L, f8, triple letter, empty" [disabled] [ref=e193]:
            - generic [ref=e194]: 3L
          - button "C 3, g8, committed" [disabled] [ref=e195]:
            - generic [ref=e196]: C
            - generic [ref=e197]: "3"
          - button "A 1, h8, committed" [disabled] [ref=e198]:
            - generic [ref=e199]: A
            - generic [ref=e200]: "1"
          - button "T 1, i8, committed" [disabled] [ref=e201]:
            - generic [ref=e202]: T
            - generic [ref=e203]: "1"
          - button "S 1, j8, committed" [disabled] [ref=e204]:
            - generic [ref=e205]: S
            - generic [ref=e206]: "1"
          - button "k8, empty" [disabled] [ref=e207]
          - button "l8, empty" [disabled] [ref=e208]
          - button "m8, empty" [disabled] [ref=e209]
          - button "n8, empty" [disabled] [ref=e210]
          - button "2L, o8, double letter, empty" [disabled] [ref=e211]:
            - generic [ref=e212]: 2L
          - generic [ref=e213]: "9"
          - button "a9, empty" [disabled] [ref=e214]
          - button "2W, b9, double word, empty" [disabled] [ref=e215]:
            - generic [ref=e216]: 2W
          - button "c9, empty" [disabled] [ref=e217]
          - button "d9, empty" [disabled] [ref=e218]
          - button "2L, e9, double letter, empty" [disabled] [ref=e219]:
            - generic [ref=e220]: 2L
          - button "f9, empty" [disabled] [ref=e221]
          - button "2L, g9, double letter, empty" [disabled] [ref=e222]:
            - generic [ref=e223]: 2L
          - button "h9, empty" [disabled] [ref=e224]
          - button "O 1, i9, committed" [disabled] [ref=e225]:
            - generic [ref=e226]: O
            - generic [ref=e227]: "1"
          - button "j9, empty" [disabled] [ref=e228]
          - button "2L, k9, double letter, empty" [disabled] [ref=e229]:
            - generic [ref=e230]: 2L
          - button "l9, empty" [disabled] [ref=e231]
          - button "m9, empty" [disabled] [ref=e232]
          - button "2W, n9, double word, empty" [disabled] [ref=e233]:
            - generic [ref=e234]: 2W
          - button "o9, empty" [disabled] [ref=e235]
          - generic [ref=e236]: "10"
          - button "a10, empty" [disabled] [ref=e237]
          - button "b10, empty" [disabled] [ref=e238]
          - button "c10, empty" [disabled] [ref=e239]
          - button "d10, empty" [disabled] [ref=e240]
          - button "e10, empty" [disabled] [ref=e241]
          - button "f10, empty" [disabled] [ref=e242]
          - button "g10, empty" [disabled] [ref=e243]
          - button "3L, h10, triple letter, empty" [disabled] [ref=e244]:
            - generic [ref=e245]: 3L
          - button "E 1, i10, committed" [disabled] [ref=e246]:
            - generic [ref=e247]: E
            - generic [ref=e248]: "1"
          - button "j10, empty" [disabled] [ref=e249]
          - button "k10, empty" [disabled] [ref=e250]
          - button "l10, empty" [disabled] [ref=e251]
          - button "m10, empty" [disabled] [ref=e252]
          - button "n10, empty" [disabled] [ref=e253]
          - button "o10, empty" [disabled] [ref=e254]
          - generic [ref=e255]: "11"
          - button "3W, a11, triple word, empty" [disabled] [ref=e256]:
            - generic [ref=e257]: 3W
          - button "b11, empty" [disabled] [ref=e258]
          - button "3L, c11, triple letter, empty" [disabled] [ref=e259]:
            - generic [ref=e260]: 3L
          - button "d11, empty" [disabled] [ref=e261]
          - button "e11, empty" [disabled] [ref=e262]
          - button "f11, empty" [disabled] [ref=e263]
          - button "2L, g11, double letter, empty" [disabled] [ref=e264]:
            - generic [ref=e265]: 2L
          - button "h11, empty" [disabled] [ref=e266]
          - button "2L, i11, double letter, empty" [disabled] [ref=e267]:
            - generic [ref=e268]: 2L
          - button "j11, empty" [disabled] [ref=e269]
          - button "k11, empty" [disabled] [ref=e270]
          - button "l11, empty" [disabled] [ref=e271]
          - button "3L, m11, triple letter, empty" [disabled] [ref=e272]:
            - generic [ref=e273]: 3L
          - button "n11, empty" [disabled] [ref=e274]
          - button "3W, o11, triple word, empty" [disabled] [ref=e275]:
            - generic [ref=e276]: 3W
          - generic [ref=e277]: "12"
          - button "a12, empty" [disabled] [ref=e278]
          - button "2L, b12, double letter, empty" [disabled] [ref=e279]:
            - generic [ref=e280]: 2L
          - button "c12, empty" [disabled] [ref=e281]
          - button "2W, d12, double word, empty" [disabled] [ref=e282]:
            - generic [ref=e283]: 2W
          - button "e12, empty" [disabled] [ref=e284]
          - button "f12, empty" [disabled] [ref=e285]
          - button "g12, empty" [disabled] [ref=e286]
          - button "h12, empty" [disabled] [ref=e287]
          - button "i12, empty" [disabled] [ref=e288]
          - button "j12, empty" [disabled] [ref=e289]
          - button "k12, empty" [disabled] [ref=e290]
          - button "2W, l12, double word, empty" [disabled] [ref=e291]:
            - generic [ref=e292]: 2W
          - button "m12, empty" [disabled] [ref=e293]
          - button "2L, n12, double letter, empty" [disabled] [ref=e294]:
            - generic [ref=e295]: 2L
          - button "o12, empty" [disabled] [ref=e296]
          - generic [ref=e297]: "13"
          - button "a13, empty" [disabled] [ref=e298]
          - button "b13, empty" [disabled] [ref=e299]
          - button "c13, empty" [disabled] [ref=e300]
          - button "d13, empty" [disabled] [ref=e301]
          - button "3L, e13, triple letter, empty" [disabled] [ref=e302]:
            - generic [ref=e303]: 3L
          - button "f13, empty" [disabled] [ref=e304]
          - button "g13, empty" [disabled] [ref=e305]
          - button "h13, empty" [disabled] [ref=e306]
          - button "i13, empty" [disabled] [ref=e307]
          - button "j13, empty" [disabled] [ref=e308]
          - button "3L, k13, triple letter, empty" [disabled] [ref=e309]:
            - generic [ref=e310]: 3L
          - button "l13, empty" [disabled] [ref=e311]
          - button "m13, empty" [disabled] [ref=e312]
          - button "n13, empty" [disabled] [ref=e313]
          - button "o13, empty" [disabled] [ref=e314]
          - generic [ref=e315]: "14"
          - button "a14, empty" [disabled] [ref=e316]
          - button "b14, empty" [disabled] [ref=e317]
          - button "c14, empty" [disabled] [ref=e318]
          - button "2L, d14, double letter, empty" [disabled] [ref=e319]:
            - generic [ref=e320]: 2L
          - button "e14, empty" [disabled] [ref=e321]
          - button "f14, empty" [disabled] [ref=e322]
          - button "2W, g14, double word, empty" [disabled] [ref=e323]:
            - generic [ref=e324]: 2W
          - button "h14, empty" [disabled] [ref=e325]
          - button "2W, i14, double word, empty" [disabled] [ref=e326]:
            - generic [ref=e327]: 2W
          - button "j14, empty" [disabled] [ref=e328]
          - button "k14, empty" [disabled] [ref=e329]
          - button "2L, l14, double letter, empty" [disabled] [ref=e330]:
            - generic [ref=e331]: 2L
          - button "m14, empty" [disabled] [ref=e332]
          - button "n14, empty" [disabled] [ref=e333]
          - button "o14, empty" [disabled] [ref=e334]
          - generic [ref=e335]: "15"
          - button "2L, a15, double letter, empty" [disabled] [ref=e336]:
            - generic [ref=e337]: 2L
          - button "b15, empty" [disabled] [ref=e338]
          - button "c15, empty" [disabled] [ref=e339]
          - button "d15, empty" [disabled] [ref=e340]
          - button "3W, e15, triple word, empty" [disabled] [ref=e341]:
            - generic [ref=e342]: 3W
          - button "f15, empty" [disabled] [ref=e343]
          - button "g15, empty" [disabled] [ref=e344]
          - button "2L, h15, double letter, empty" [disabled] [ref=e345]:
            - generic [ref=e346]: 2L
          - button "i15, empty" [disabled] [ref=e347]
          - button "j15, empty" [disabled] [ref=e348]
          - button "3W, k15, triple word, empty" [disabled] [ref=e349]:
            - generic [ref=e350]: 3W
          - button "l15, empty" [disabled] [ref=e351]
          - button "m15, empty" [disabled] [ref=e352]
          - button "n15, empty" [disabled] [ref=e353]
          - button "2L, o15, double letter, empty" [disabled] [ref=e354]:
            - generic [ref=e355]: 2L
      - generic [ref=e356]:
        - generic [ref=e357]:
          - img "Whole board overview; outline shows the enlarged area" [ref=e358]
          - group "View a board region" [ref=e585]:
            - button "View a1 to e5" [ref=e586] [cursor=pointer]
            - button "View f1 to j5" [ref=e587] [cursor=pointer]
            - button "View k1 to o5" [ref=e588] [cursor=pointer]
            - button "View a6 to e10" [ref=e589] [cursor=pointer]
            - button "View f6 to j10" [ref=e590] [cursor=pointer]
            - button "View k6 to o10" [ref=e591] [cursor=pointer]
            - button "View a11 to e15" [ref=e592] [cursor=pointer]
            - button "View f11 to j15" [ref=e593] [cursor=pointer]
            - button "View k11 to o15" [ref=e594] [cursor=pointer]
        - generic [ref=e595]:
          - generic [ref=e596]:
            - button "Fit board" [ref=e597] [cursor=pointer]:
              - paragraph [ref=e600]: Fit board
            - button "Enlarge board" [pressed] [ref=e601] [cursor=pointer]:
              - paragraph [ref=e604]: Enlarge board
          - paragraph [ref=e605]: S 1, j8, committed
          - 'button "Board map: locate a square" [ref=e606] [cursor=pointer]': Map
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