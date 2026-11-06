# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-puzzle--reach-target regression word-tiles-puzzle-retry-keeps-draft
- Location: tests/storybook/stories.checks.ts:211:1

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  67188 pixels (ratio 0.21 of all image pixels) are different.

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
  - 67188 pixels (ratio 0.21 of all image pixels) are different.
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
  - 67188 pixels (ratio 0.21 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e10]:
    - paragraph [ref=e11]: Score at least 6 points in one move.
    - status [ref=e12]: Your last move scored 8 of 6.
    - status [ref=e13]: Target reached. Puzzle solved!
    - generic [ref=e14]:
      - generic [ref=e15]:
        - button "Fit board" [pressed] [ref=e16] [cursor=pointer]:
          - paragraph [ref=e19]: Fit board
        - button "Enlarge board" [ref=e20] [cursor=pointer]:
          - paragraph [ref=e23]: Enlarge board
      - region "Scrollable word board" [ref=e24]:
        - group "Puzzle board, fifteen columns and fifteen rows" [ref=e25]:
          - generic [ref=e27]: a
          - generic [ref=e28]: b
          - generic [ref=e29]: c
          - generic [ref=e30]: d
          - generic [ref=e31]: e
          - generic [ref=e32]: f
          - generic [ref=e33]: g
          - generic [ref=e34]: h
          - generic [ref=e35]: i
          - generic [ref=e36]: j
          - generic [ref=e37]: k
          - generic [ref=e38]: l
          - generic [ref=e39]: m
          - generic [ref=e40]: "n"
          - generic [ref=e41]: o
          - generic [ref=e42]: "1"
          - button "2L, a1, double letter, empty" [disabled] [ref=e43]:
            - generic [ref=e44]: 2L
          - button "b1, empty" [disabled] [ref=e45]
          - button "c1, empty" [disabled] [ref=e46]
          - button "d1, empty" [disabled] [ref=e47]
          - button "3W, e1, triple word, empty" [disabled] [ref=e48]:
            - generic [ref=e49]: 3W
          - button "f1, empty" [disabled] [ref=e50]
          - button "g1, empty" [disabled] [ref=e51]
          - button "2L, h1, double letter, empty" [disabled] [ref=e52]:
            - generic [ref=e53]: 2L
          - button "i1, empty" [disabled] [ref=e54]
          - button "j1, empty" [disabled] [ref=e55]
          - button "3W, k1, triple word, empty" [disabled] [ref=e56]:
            - generic [ref=e57]: 3W
          - button "l1, empty" [disabled] [ref=e58]
          - button "m1, empty" [disabled] [ref=e59]
          - button "n1, empty" [disabled] [ref=e60]
          - button "2L, o1, double letter, empty" [disabled] [ref=e61]:
            - generic [ref=e62]: 2L
          - generic [ref=e63]: "2"
          - button "a2, empty" [disabled] [ref=e64]
          - button "b2, empty" [disabled] [ref=e65]
          - button "c2, empty" [disabled] [ref=e66]
          - button "2L, d2, double letter, empty" [disabled] [ref=e67]:
            - generic [ref=e68]: 2L
          - button "e2, empty" [disabled] [ref=e69]
          - button "f2, empty" [disabled] [ref=e70]
          - button "2W, g2, double word, empty" [disabled] [ref=e71]:
            - generic [ref=e72]: 2W
          - button "h2, empty" [disabled] [ref=e73]
          - button "2W, i2, double word, empty" [disabled] [ref=e74]:
            - generic [ref=e75]: 2W
          - button "j2, empty" [disabled] [ref=e76]
          - button "k2, empty" [disabled] [ref=e77]
          - button "2L, l2, double letter, empty" [disabled] [ref=e78]:
            - generic [ref=e79]: 2L
          - button "m2, empty" [disabled] [ref=e80]
          - button "n2, empty" [disabled] [ref=e81]
          - button "o2, empty" [disabled] [ref=e82]
          - generic [ref=e83]: "3"
          - button "a3, empty" [disabled] [ref=e84]
          - button "b3, empty" [disabled] [ref=e85]
          - button "c3, empty" [disabled] [ref=e86]
          - button "d3, empty" [disabled] [ref=e87]
          - button "3L, e3, triple letter, empty" [disabled] [ref=e88]:
            - generic [ref=e89]: 3L
          - button "f3, empty" [disabled] [ref=e90]
          - button "g3, empty" [disabled] [ref=e91]
          - button "h3, empty" [disabled] [ref=e92]
          - button "i3, empty" [disabled] [ref=e93]
          - button "j3, empty" [disabled] [ref=e94]
          - button "3L, k3, triple letter, empty" [disabled] [ref=e95]:
            - generic [ref=e96]: 3L
          - button "l3, empty" [disabled] [ref=e97]
          - button "m3, empty" [disabled] [ref=e98]
          - button "n3, empty" [disabled] [ref=e99]
          - button "o3, empty" [disabled] [ref=e100]
          - generic [ref=e101]: "4"
          - button "a4, empty" [disabled] [ref=e102]
          - button "2L, b4, double letter, empty" [disabled] [ref=e103]:
            - generic [ref=e104]: 2L
          - button "c4, empty" [disabled] [ref=e105]
          - button "2W, d4, double word, empty" [disabled] [ref=e106]:
            - generic [ref=e107]: 2W
          - button "e4, empty" [disabled] [ref=e108]
          - button "f4, empty" [disabled] [ref=e109]
          - button "g4, empty" [disabled] [ref=e110]
          - button "h4, empty" [disabled] [ref=e111]
          - button "i4, empty" [disabled] [ref=e112]
          - button "j4, empty" [disabled] [ref=e113]
          - button "k4, empty" [disabled] [ref=e114]
          - button "2W, l4, double word, empty" [disabled] [ref=e115]:
            - generic [ref=e116]: 2W
          - button "m4, empty" [disabled] [ref=e117]
          - button "2L, n4, double letter, empty" [disabled] [ref=e118]:
            - generic [ref=e119]: 2L
          - button "o4, empty" [disabled] [ref=e120]
          - generic [ref=e121]: "5"
          - button "3W, a5, triple word, empty" [disabled] [ref=e122]:
            - generic [ref=e123]: 3W
          - button "b5, empty" [disabled] [ref=e124]
          - button "3L, c5, triple letter, empty" [disabled] [ref=e125]:
            - generic [ref=e126]: 3L
          - button "d5, empty" [disabled] [ref=e127]
          - button "e5, empty" [disabled] [ref=e128]
          - button "f5, empty" [disabled] [ref=e129]
          - button "2L, g5, double letter, empty" [disabled] [ref=e130]:
            - generic [ref=e131]: 2L
          - button "h5, empty" [disabled] [ref=e132]
          - button "2L, i5, double letter, empty" [disabled] [ref=e133]:
            - generic [ref=e134]: 2L
          - button "j5, empty" [disabled] [ref=e135]
          - button "k5, empty" [disabled] [ref=e136]
          - button "l5, empty" [disabled] [ref=e137]
          - button "3L, m5, triple letter, empty" [disabled] [ref=e138]:
            - generic [ref=e139]: 3L
          - button "n5, empty" [disabled] [ref=e140]
          - button "3W, o5, triple word, empty" [disabled] [ref=e141]:
            - generic [ref=e142]: 3W
          - generic [ref=e143]: "6"
          - button "a6, empty" [disabled] [ref=e144]
          - button "b6, empty" [disabled] [ref=e145]
          - button "c6, empty" [disabled] [ref=e146]
          - button "d6, empty" [disabled] [ref=e147]
          - button "e6, empty" [disabled] [ref=e148]
          - button "f6, empty" [disabled] [ref=e149]
          - button "g6, empty" [disabled] [ref=e150]
          - button "3L, h6, triple letter, empty" [disabled] [ref=e151]:
            - generic [ref=e152]: 3L
          - button "i6, empty" [disabled] [ref=e153]
          - button "j6, empty" [disabled] [ref=e154]
          - button "k6, empty" [disabled] [ref=e155]
          - button "l6, empty" [disabled] [ref=e156]
          - button "m6, empty" [disabled] [ref=e157]
          - button "n6, empty" [disabled] [ref=e158]
          - button "o6, empty" [disabled] [ref=e159]
          - generic [ref=e160]: "7"
          - button "a7, empty" [disabled] [ref=e161]
          - button "2W, b7, double word, empty" [disabled] [ref=e162]:
            - generic [ref=e163]: 2W
          - button "c7, empty" [disabled] [ref=e164]
          - button "d7, empty" [disabled] [ref=e165]
          - button "2L, e7, double letter, empty" [disabled] [ref=e166]:
            - generic [ref=e167]: 2L
          - button "f7, empty" [disabled] [ref=e168]
          - button "2L, g7, double letter, empty" [disabled] [ref=e169]:
            - generic [ref=e170]: 2L
          - button "h7, empty" [disabled] [ref=e171]
          - button "2L, i7, double letter, empty" [disabled] [ref=e172]:
            - generic [ref=e173]: 2L
          - button "j7, empty" [disabled] [ref=e174]
          - button "2L, k7, double letter, empty" [disabled] [ref=e175]:
            - generic [ref=e176]: 2L
          - button "l7, empty" [disabled] [ref=e177]
          - button "m7, empty" [disabled] [ref=e178]
          - button "2W, n7, double word, empty" [disabled] [ref=e179]:
            - generic [ref=e180]: 2W
          - button "o7, empty" [disabled] [ref=e181]
          - generic [ref=e182]: "8"
          - button "2L, a8, double letter, empty" [disabled] [ref=e183]:
            - generic [ref=e184]: 2L
          - button "b8, empty" [disabled] [ref=e185]
          - button "c8, empty" [disabled] [ref=e186]
          - button "d8, empty" [disabled] [ref=e187]
          - button "e8, empty" [disabled] [ref=e188]
          - button "3L, f8, triple letter, empty" [disabled] [ref=e189]:
            - generic [ref=e190]: 3L
          - button "C 3, g8, committed" [disabled] [ref=e191]:
            - generic [ref=e192]: C
          - button "A 1, h8, committed" [disabled] [ref=e193]:
            - generic [ref=e194]: A
          - button "T 1, i8, committed" [disabled] [ref=e195]:
            - generic [ref=e196]: T
          - button "S 1, j8, committed" [disabled] [ref=e197]:
            - generic [ref=e198]: S
          - button "k8, empty" [disabled] [ref=e199]
          - button "l8, empty" [disabled] [ref=e200]
          - button "m8, empty" [disabled] [ref=e201]
          - button "n8, empty" [disabled] [ref=e202]
          - button "2L, o8, double letter, empty" [disabled] [ref=e203]:
            - generic [ref=e204]: 2L
          - generic [ref=e205]: "9"
          - button "a9, empty" [disabled] [ref=e206]
          - button "2W, b9, double word, empty" [disabled] [ref=e207]:
            - generic [ref=e208]: 2W
          - button "c9, empty" [disabled] [ref=e209]
          - button "d9, empty" [disabled] [ref=e210]
          - button "2L, e9, double letter, empty" [disabled] [ref=e211]:
            - generic [ref=e212]: 2L
          - button "f9, empty" [disabled] [ref=e213]
          - button "2L, g9, double letter, empty" [disabled] [ref=e214]:
            - generic [ref=e215]: 2L
          - button "h9, empty" [disabled] [ref=e216]
          - button "O 1, i9, committed" [disabled] [ref=e217]:
            - generic [ref=e218]: O
          - button "j9, empty" [disabled] [ref=e219]
          - button "2L, k9, double letter, empty" [disabled] [ref=e220]:
            - generic [ref=e221]: 2L
          - button "l9, empty" [disabled] [ref=e222]
          - button "m9, empty" [disabled] [ref=e223]
          - button "2W, n9, double word, empty" [disabled] [ref=e224]:
            - generic [ref=e225]: 2W
          - button "o9, empty" [disabled] [ref=e226]
          - generic [ref=e227]: "10"
          - button "a10, empty" [disabled] [ref=e228]
          - button "b10, empty" [disabled] [ref=e229]
          - button "c10, empty" [disabled] [ref=e230]
          - button "d10, empty" [disabled] [ref=e231]
          - button "e10, empty" [disabled] [ref=e232]
          - button "f10, empty" [disabled] [ref=e233]
          - button "g10, empty" [disabled] [ref=e234]
          - button "3L, h10, triple letter, empty" [disabled] [ref=e235]:
            - generic [ref=e236]: 3L
          - button "E 1, i10, committed" [disabled] [ref=e237]:
            - generic [ref=e238]: E
          - button "j10, empty" [disabled] [ref=e239]
          - button "k10, empty" [disabled] [ref=e240]
          - button "l10, empty" [disabled] [ref=e241]
          - button "m10, empty" [disabled] [ref=e242]
          - button "n10, empty" [disabled] [ref=e243]
          - button "o10, empty" [disabled] [ref=e244]
          - generic [ref=e245]: "11"
          - button "3W, a11, triple word, empty" [disabled] [ref=e246]:
            - generic [ref=e247]: 3W
          - button "b11, empty" [disabled] [ref=e248]
          - button "3L, c11, triple letter, empty" [disabled] [ref=e249]:
            - generic [ref=e250]: 3L
          - button "d11, empty" [disabled] [ref=e251]
          - button "e11, empty" [disabled] [ref=e252]
          - button "f11, empty" [disabled] [ref=e253]
          - button "2L, g11, double letter, empty" [disabled] [ref=e254]:
            - generic [ref=e255]: 2L
          - button "h11, empty" [disabled] [ref=e256]
          - button "2L, i11, double letter, empty" [disabled] [ref=e257]:
            - generic [ref=e258]: 2L
          - button "j11, empty" [disabled] [ref=e259]
          - button "k11, empty" [disabled] [ref=e260]
          - button "l11, empty" [disabled] [ref=e261]
          - button "3L, m11, triple letter, empty" [disabled] [ref=e262]:
            - generic [ref=e263]: 3L
          - button "n11, empty" [disabled] [ref=e264]
          - button "3W, o11, triple word, empty" [disabled] [ref=e265]:
            - generic [ref=e266]: 3W
          - generic [ref=e267]: "12"
          - button "a12, empty" [disabled] [ref=e268]
          - button "2L, b12, double letter, empty" [disabled] [ref=e269]:
            - generic [ref=e270]: 2L
          - button "c12, empty" [disabled] [ref=e271]
          - button "2W, d12, double word, empty" [disabled] [ref=e272]:
            - generic [ref=e273]: 2W
          - button "e12, empty" [disabled] [ref=e274]
          - button "f12, empty" [disabled] [ref=e275]
          - button "g12, empty" [disabled] [ref=e276]
          - button "h12, empty" [disabled] [ref=e277]
          - button "i12, empty" [disabled] [ref=e278]
          - button "j12, empty" [disabled] [ref=e279]
          - button "k12, empty" [disabled] [ref=e280]
          - button "2W, l12, double word, empty" [disabled] [ref=e281]:
            - generic [ref=e282]: 2W
          - button "m12, empty" [disabled] [ref=e283]
          - button "2L, n12, double letter, empty" [disabled] [ref=e284]:
            - generic [ref=e285]: 2L
          - button "o12, empty" [disabled] [ref=e286]
          - generic [ref=e287]: "13"
          - button "a13, empty" [disabled] [ref=e288]
          - button "b13, empty" [disabled] [ref=e289]
          - button "c13, empty" [disabled] [ref=e290]
          - button "d13, empty" [disabled] [ref=e291]
          - button "3L, e13, triple letter, empty" [disabled] [ref=e292]:
            - generic [ref=e293]: 3L
          - button "f13, empty" [disabled] [ref=e294]
          - button "g13, empty" [disabled] [ref=e295]
          - button "h13, empty" [disabled] [ref=e296]
          - button "i13, empty" [disabled] [ref=e297]
          - button "j13, empty" [disabled] [ref=e298]
          - button "3L, k13, triple letter, empty" [disabled] [ref=e299]:
            - generic [ref=e300]: 3L
          - button "l13, empty" [disabled] [ref=e301]
          - button "m13, empty" [disabled] [ref=e302]
          - button "n13, empty" [disabled] [ref=e303]
          - button "o13, empty" [disabled] [ref=e304]
          - generic [ref=e305]: "14"
          - button "a14, empty" [disabled] [ref=e306]
          - button "b14, empty" [disabled] [ref=e307]
          - button "c14, empty" [disabled] [ref=e308]
          - button "2L, d14, double letter, empty" [disabled] [ref=e309]:
            - generic [ref=e310]: 2L
          - button "e14, empty" [disabled] [ref=e311]
          - button "f14, empty" [disabled] [ref=e312]
          - button "2W, g14, double word, empty" [disabled] [ref=e313]:
            - generic [ref=e314]: 2W
          - button "h14, empty" [disabled] [ref=e315]
          - button "2W, i14, double word, empty" [disabled] [ref=e316]:
            - generic [ref=e317]: 2W
          - button "j14, empty" [disabled] [ref=e318]
          - button "k14, empty" [disabled] [ref=e319]
          - button "2L, l14, double letter, empty" [disabled] [ref=e320]:
            - generic [ref=e321]: 2L
          - button "m14, empty" [disabled] [ref=e322]
          - button "n14, empty" [disabled] [ref=e323]
          - button "o14, empty" [disabled] [ref=e324]
          - generic [ref=e325]: "15"
          - button "2L, a15, double letter, empty" [disabled] [ref=e326]:
            - generic [ref=e327]: 2L
          - button "b15, empty" [disabled] [ref=e328]
          - button "c15, empty" [disabled] [ref=e329]
          - button "d15, empty" [disabled] [ref=e330]
          - button "3W, e15, triple word, empty" [disabled] [ref=e331]:
            - generic [ref=e332]: 3W
          - button "f15, empty" [disabled] [ref=e333]
          - button "g15, empty" [disabled] [ref=e334]
          - button "2L, h15, double letter, empty" [disabled] [ref=e335]:
            - generic [ref=e336]: 2L
          - button "i15, empty" [disabled] [ref=e337]
          - button "j15, empty" [disabled] [ref=e338]
          - button "3W, k15, triple word, empty" [disabled] [ref=e339]:
            - generic [ref=e340]: 3W
          - button "l15, empty" [disabled] [ref=e341]
          - button "m15, empty" [disabled] [ref=e342]
          - button "n15, empty" [disabled] [ref=e343]
          - button "2L, o15, double letter, empty" [disabled] [ref=e344]:
            - generic [ref=e345]: 2L
    - paragraph [ref=e346]: "Bonus squares: 2L doubles a letter, 3L triples a letter, 2W doubles the word, 3W triples the word."
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