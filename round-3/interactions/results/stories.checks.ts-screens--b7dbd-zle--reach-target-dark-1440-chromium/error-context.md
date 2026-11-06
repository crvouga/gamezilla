# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-puzzle--reach-target dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  108078 pixels (ratio 0.09 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-puzzle/reach-target-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-puzzle/reach-target-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 108078 pixels (ratio 0.09 of all image pixels) are different.
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
  - 108078 pixels (ratio 0.09 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e13]:
    - paragraph [ref=e14]: Score at least 6 points in one move.
    - status [ref=e15]: Your last move scored 8 of 6.
    - status [ref=e16]: Target reached. Puzzle solved!
    - generic [ref=e17]:
      - generic [ref=e18]:
        - button "Fit board" [pressed] [ref=e19] [cursor=pointer]:
          - paragraph [ref=e22]: Fit board
        - button "Enlarge board" [ref=e23] [cursor=pointer]:
          - paragraph [ref=e26]: Enlarge board
      - region "Scrollable word board" [ref=e27]:
        - group "Puzzle board, fifteen columns and fifteen rows" [ref=e28]:
          - generic [ref=e30]: a
          - generic [ref=e31]: b
          - generic [ref=e32]: c
          - generic [ref=e33]: d
          - generic [ref=e34]: e
          - generic [ref=e35]: f
          - generic [ref=e36]: g
          - generic [ref=e37]: h
          - generic [ref=e38]: i
          - generic [ref=e39]: j
          - generic [ref=e40]: k
          - generic [ref=e41]: l
          - generic [ref=e42]: m
          - generic [ref=e43]: "n"
          - generic [ref=e44]: o
          - generic [ref=e45]: "1"
          - button "2L, a1, double letter, empty" [disabled] [ref=e46]:
            - generic [ref=e47]: 2L
          - button "b1, empty" [disabled] [ref=e48]
          - button "c1, empty" [disabled] [ref=e49]
          - button "d1, empty" [disabled] [ref=e50]
          - button "3W, e1, triple word, empty" [disabled] [ref=e51]:
            - generic [ref=e52]: 3W
          - button "f1, empty" [disabled] [ref=e53]
          - button "g1, empty" [disabled] [ref=e54]
          - button "2L, h1, double letter, empty" [disabled] [ref=e55]:
            - generic [ref=e56]: 2L
          - button "i1, empty" [disabled] [ref=e57]
          - button "j1, empty" [disabled] [ref=e58]
          - button "3W, k1, triple word, empty" [disabled] [ref=e59]:
            - generic [ref=e60]: 3W
          - button "l1, empty" [disabled] [ref=e61]
          - button "m1, empty" [disabled] [ref=e62]
          - button "n1, empty" [disabled] [ref=e63]
          - button "2L, o1, double letter, empty" [disabled] [ref=e64]:
            - generic [ref=e65]: 2L
          - generic [ref=e66]: "2"
          - button "a2, empty" [disabled] [ref=e67]
          - button "b2, empty" [disabled] [ref=e68]
          - button "c2, empty" [disabled] [ref=e69]
          - button "2L, d2, double letter, empty" [disabled] [ref=e70]:
            - generic [ref=e71]: 2L
          - button "e2, empty" [disabled] [ref=e72]
          - button "f2, empty" [disabled] [ref=e73]
          - button "2W, g2, double word, empty" [disabled] [ref=e74]:
            - generic [ref=e75]: 2W
          - button "h2, empty" [disabled] [ref=e76]
          - button "2W, i2, double word, empty" [disabled] [ref=e77]:
            - generic [ref=e78]: 2W
          - button "j2, empty" [disabled] [ref=e79]
          - button "k2, empty" [disabled] [ref=e80]
          - button "2L, l2, double letter, empty" [disabled] [ref=e81]:
            - generic [ref=e82]: 2L
          - button "m2, empty" [disabled] [ref=e83]
          - button "n2, empty" [disabled] [ref=e84]
          - button "o2, empty" [disabled] [ref=e85]
          - generic [ref=e86]: "3"
          - button "a3, empty" [disabled] [ref=e87]
          - button "b3, empty" [disabled] [ref=e88]
          - button "c3, empty" [disabled] [ref=e89]
          - button "d3, empty" [disabled] [ref=e90]
          - button "3L, e3, triple letter, empty" [disabled] [ref=e91]:
            - generic [ref=e92]: 3L
          - button "f3, empty" [disabled] [ref=e93]
          - button "g3, empty" [disabled] [ref=e94]
          - button "h3, empty" [disabled] [ref=e95]
          - button "i3, empty" [disabled] [ref=e96]
          - button "j3, empty" [disabled] [ref=e97]
          - button "3L, k3, triple letter, empty" [disabled] [ref=e98]:
            - generic [ref=e99]: 3L
          - button "l3, empty" [disabled] [ref=e100]
          - button "m3, empty" [disabled] [ref=e101]
          - button "n3, empty" [disabled] [ref=e102]
          - button "o3, empty" [disabled] [ref=e103]
          - generic [ref=e104]: "4"
          - button "a4, empty" [disabled] [ref=e105]
          - button "2L, b4, double letter, empty" [disabled] [ref=e106]:
            - generic [ref=e107]: 2L
          - button "c4, empty" [disabled] [ref=e108]
          - button "2W, d4, double word, empty" [disabled] [ref=e109]:
            - generic [ref=e110]: 2W
          - button "e4, empty" [disabled] [ref=e111]
          - button "f4, empty" [disabled] [ref=e112]
          - button "g4, empty" [disabled] [ref=e113]
          - button "h4, empty" [disabled] [ref=e114]
          - button "i4, empty" [disabled] [ref=e115]
          - button "j4, empty" [disabled] [ref=e116]
          - button "k4, empty" [disabled] [ref=e117]
          - button "2W, l4, double word, empty" [disabled] [ref=e118]:
            - generic [ref=e119]: 2W
          - button "m4, empty" [disabled] [ref=e120]
          - button "2L, n4, double letter, empty" [disabled] [ref=e121]:
            - generic [ref=e122]: 2L
          - button "o4, empty" [disabled] [ref=e123]
          - generic [ref=e124]: "5"
          - button "3W, a5, triple word, empty" [disabled] [ref=e125]:
            - generic [ref=e126]: 3W
          - button "b5, empty" [disabled] [ref=e127]
          - button "3L, c5, triple letter, empty" [disabled] [ref=e128]:
            - generic [ref=e129]: 3L
          - button "d5, empty" [disabled] [ref=e130]
          - button "e5, empty" [disabled] [ref=e131]
          - button "f5, empty" [disabled] [ref=e132]
          - button "2L, g5, double letter, empty" [disabled] [ref=e133]:
            - generic [ref=e134]: 2L
          - button "h5, empty" [disabled] [ref=e135]
          - button "2L, i5, double letter, empty" [disabled] [ref=e136]:
            - generic [ref=e137]: 2L
          - button "j5, empty" [disabled] [ref=e138]
          - button "k5, empty" [disabled] [ref=e139]
          - button "l5, empty" [disabled] [ref=e140]
          - button "3L, m5, triple letter, empty" [disabled] [ref=e141]:
            - generic [ref=e142]: 3L
          - button "n5, empty" [disabled] [ref=e143]
          - button "3W, o5, triple word, empty" [disabled] [ref=e144]:
            - generic [ref=e145]: 3W
          - generic [ref=e146]: "6"
          - button "a6, empty" [disabled] [ref=e147]
          - button "b6, empty" [disabled] [ref=e148]
          - button "c6, empty" [disabled] [ref=e149]
          - button "d6, empty" [disabled] [ref=e150]
          - button "e6, empty" [disabled] [ref=e151]
          - button "f6, empty" [disabled] [ref=e152]
          - button "g6, empty" [disabled] [ref=e153]
          - button "3L, h6, triple letter, empty" [disabled] [ref=e154]:
            - generic [ref=e155]: 3L
          - button "i6, empty" [disabled] [ref=e156]
          - button "j6, empty" [disabled] [ref=e157]
          - button "k6, empty" [disabled] [ref=e158]
          - button "l6, empty" [disabled] [ref=e159]
          - button "m6, empty" [disabled] [ref=e160]
          - button "n6, empty" [disabled] [ref=e161]
          - button "o6, empty" [disabled] [ref=e162]
          - generic [ref=e163]: "7"
          - button "a7, empty" [disabled] [ref=e164]
          - button "2W, b7, double word, empty" [disabled] [ref=e165]:
            - generic [ref=e166]: 2W
          - button "c7, empty" [disabled] [ref=e167]
          - button "d7, empty" [disabled] [ref=e168]
          - button "2L, e7, double letter, empty" [disabled] [ref=e169]:
            - generic [ref=e170]: 2L
          - button "f7, empty" [disabled] [ref=e171]
          - button "2L, g7, double letter, empty" [disabled] [ref=e172]:
            - generic [ref=e173]: 2L
          - button "h7, empty" [disabled] [ref=e174]
          - button "2L, i7, double letter, empty" [disabled] [ref=e175]:
            - generic [ref=e176]: 2L
          - button "j7, empty" [disabled] [ref=e177]
          - button "2L, k7, double letter, empty" [disabled] [ref=e178]:
            - generic [ref=e179]: 2L
          - button "l7, empty" [disabled] [ref=e180]
          - button "m7, empty" [disabled] [ref=e181]
          - button "2W, n7, double word, empty" [disabled] [ref=e182]:
            - generic [ref=e183]: 2W
          - button "o7, empty" [disabled] [ref=e184]
          - generic [ref=e185]: "8"
          - button "2L, a8, double letter, empty" [disabled] [ref=e186]:
            - generic [ref=e187]: 2L
          - button "b8, empty" [disabled] [ref=e188]
          - button "c8, empty" [disabled] [ref=e189]
          - button "d8, empty" [disabled] [ref=e190]
          - button "e8, empty" [disabled] [ref=e191]
          - button "3L, f8, triple letter, empty" [disabled] [ref=e192]:
            - generic [ref=e193]: 3L
          - button "C 3, g8, committed" [disabled] [ref=e194]:
            - generic [ref=e195]: C
            - generic [ref=e196]: "3"
          - button "A 1, h8, committed" [disabled] [ref=e197]:
            - generic [ref=e198]: A
            - generic [ref=e199]: "1"
          - button "T 1, i8, committed" [disabled] [ref=e200]:
            - generic [ref=e201]: T
            - generic [ref=e202]: "1"
          - button "S 1, j8, committed" [disabled] [ref=e203]:
            - generic [ref=e204]: S
            - generic [ref=e205]: "1"
          - button "k8, empty" [disabled] [ref=e206]
          - button "l8, empty" [disabled] [ref=e207]
          - button "m8, empty" [disabled] [ref=e208]
          - button "n8, empty" [disabled] [ref=e209]
          - button "2L, o8, double letter, empty" [disabled] [ref=e210]:
            - generic [ref=e211]: 2L
          - generic [ref=e212]: "9"
          - button "a9, empty" [disabled] [ref=e213]
          - button "2W, b9, double word, empty" [disabled] [ref=e214]:
            - generic [ref=e215]: 2W
          - button "c9, empty" [disabled] [ref=e216]
          - button "d9, empty" [disabled] [ref=e217]
          - button "2L, e9, double letter, empty" [disabled] [ref=e218]:
            - generic [ref=e219]: 2L
          - button "f9, empty" [disabled] [ref=e220]
          - button "2L, g9, double letter, empty" [disabled] [ref=e221]:
            - generic [ref=e222]: 2L
          - button "h9, empty" [disabled] [ref=e223]
          - button "O 1, i9, committed" [disabled] [ref=e224]:
            - generic [ref=e225]: O
            - generic [ref=e226]: "1"
          - button "j9, empty" [disabled] [ref=e227]
          - button "2L, k9, double letter, empty" [disabled] [ref=e228]:
            - generic [ref=e229]: 2L
          - button "l9, empty" [disabled] [ref=e230]
          - button "m9, empty" [disabled] [ref=e231]
          - button "2W, n9, double word, empty" [disabled] [ref=e232]:
            - generic [ref=e233]: 2W
          - button "o9, empty" [disabled] [ref=e234]
          - generic [ref=e235]: "10"
          - button "a10, empty" [disabled] [ref=e236]
          - button "b10, empty" [disabled] [ref=e237]
          - button "c10, empty" [disabled] [ref=e238]
          - button "d10, empty" [disabled] [ref=e239]
          - button "e10, empty" [disabled] [ref=e240]
          - button "f10, empty" [disabled] [ref=e241]
          - button "g10, empty" [disabled] [ref=e242]
          - button "3L, h10, triple letter, empty" [disabled] [ref=e243]:
            - generic [ref=e244]: 3L
          - button "E 1, i10, committed" [disabled] [ref=e245]:
            - generic [ref=e246]: E
            - generic [ref=e247]: "1"
          - button "j10, empty" [disabled] [ref=e248]
          - button "k10, empty" [disabled] [ref=e249]
          - button "l10, empty" [disabled] [ref=e250]
          - button "m10, empty" [disabled] [ref=e251]
          - button "n10, empty" [disabled] [ref=e252]
          - button "o10, empty" [disabled] [ref=e253]
          - generic [ref=e254]: "11"
          - button "3W, a11, triple word, empty" [disabled] [ref=e255]:
            - generic [ref=e256]: 3W
          - button "b11, empty" [disabled] [ref=e257]
          - button "3L, c11, triple letter, empty" [disabled] [ref=e258]:
            - generic [ref=e259]: 3L
          - button "d11, empty" [disabled] [ref=e260]
          - button "e11, empty" [disabled] [ref=e261]
          - button "f11, empty" [disabled] [ref=e262]
          - button "2L, g11, double letter, empty" [disabled] [ref=e263]:
            - generic [ref=e264]: 2L
          - button "h11, empty" [disabled] [ref=e265]
          - button "2L, i11, double letter, empty" [disabled] [ref=e266]:
            - generic [ref=e267]: 2L
          - button "j11, empty" [disabled] [ref=e268]
          - button "k11, empty" [disabled] [ref=e269]
          - button "l11, empty" [disabled] [ref=e270]
          - button "3L, m11, triple letter, empty" [disabled] [ref=e271]:
            - generic [ref=e272]: 3L
          - button "n11, empty" [disabled] [ref=e273]
          - button "3W, o11, triple word, empty" [disabled] [ref=e274]:
            - generic [ref=e275]: 3W
          - generic [ref=e276]: "12"
          - button "a12, empty" [disabled] [ref=e277]
          - button "2L, b12, double letter, empty" [disabled] [ref=e278]:
            - generic [ref=e279]: 2L
          - button "c12, empty" [disabled] [ref=e280]
          - button "2W, d12, double word, empty" [disabled] [ref=e281]:
            - generic [ref=e282]: 2W
          - button "e12, empty" [disabled] [ref=e283]
          - button "f12, empty" [disabled] [ref=e284]
          - button "g12, empty" [disabled] [ref=e285]
          - button "h12, empty" [disabled] [ref=e286]
          - button "i12, empty" [disabled] [ref=e287]
          - button "j12, empty" [disabled] [ref=e288]
          - button "k12, empty" [disabled] [ref=e289]
          - button "2W, l12, double word, empty" [disabled] [ref=e290]:
            - generic [ref=e291]: 2W
          - button "m12, empty" [disabled] [ref=e292]
          - button "2L, n12, double letter, empty" [disabled] [ref=e293]:
            - generic [ref=e294]: 2L
          - button "o12, empty" [disabled] [ref=e295]
          - generic [ref=e296]: "13"
          - button "a13, empty" [disabled] [ref=e297]
          - button "b13, empty" [disabled] [ref=e298]
          - button "c13, empty" [disabled] [ref=e299]
          - button "d13, empty" [disabled] [ref=e300]
          - button "3L, e13, triple letter, empty" [disabled] [ref=e301]:
            - generic [ref=e302]: 3L
          - button "f13, empty" [disabled] [ref=e303]
          - button "g13, empty" [disabled] [ref=e304]
          - button "h13, empty" [disabled] [ref=e305]
          - button "i13, empty" [disabled] [ref=e306]
          - button "j13, empty" [disabled] [ref=e307]
          - button "3L, k13, triple letter, empty" [disabled] [ref=e308]:
            - generic [ref=e309]: 3L
          - button "l13, empty" [disabled] [ref=e310]
          - button "m13, empty" [disabled] [ref=e311]
          - button "n13, empty" [disabled] [ref=e312]
          - button "o13, empty" [disabled] [ref=e313]
          - generic [ref=e314]: "14"
          - button "a14, empty" [disabled] [ref=e315]
          - button "b14, empty" [disabled] [ref=e316]
          - button "c14, empty" [disabled] [ref=e317]
          - button "2L, d14, double letter, empty" [disabled] [ref=e318]:
            - generic [ref=e319]: 2L
          - button "e14, empty" [disabled] [ref=e320]
          - button "f14, empty" [disabled] [ref=e321]
          - button "2W, g14, double word, empty" [disabled] [ref=e322]:
            - generic [ref=e323]: 2W
          - button "h14, empty" [disabled] [ref=e324]
          - button "2W, i14, double word, empty" [disabled] [ref=e325]:
            - generic [ref=e326]: 2W
          - button "j14, empty" [disabled] [ref=e327]
          - button "k14, empty" [disabled] [ref=e328]
          - button "2L, l14, double letter, empty" [disabled] [ref=e329]:
            - generic [ref=e330]: 2L
          - button "m14, empty" [disabled] [ref=e331]
          - button "n14, empty" [disabled] [ref=e332]
          - button "o14, empty" [disabled] [ref=e333]
          - generic [ref=e334]: "15"
          - button "2L, a15, double letter, empty" [disabled] [ref=e335]:
            - generic [ref=e336]: 2L
          - button "b15, empty" [disabled] [ref=e337]
          - button "c15, empty" [disabled] [ref=e338]
          - button "d15, empty" [disabled] [ref=e339]
          - button "3W, e15, triple word, empty" [disabled] [ref=e340]:
            - generic [ref=e341]: 3W
          - button "f15, empty" [disabled] [ref=e342]
          - button "g15, empty" [disabled] [ref=e343]
          - button "2L, h15, double letter, empty" [disabled] [ref=e344]:
            - generic [ref=e345]: 2L
          - button "i15, empty" [disabled] [ref=e346]
          - button "j15, empty" [disabled] [ref=e347]
          - button "3W, k15, triple word, empty" [disabled] [ref=e348]:
            - generic [ref=e349]: 3W
          - button "l15, empty" [disabled] [ref=e350]
          - button "m15, empty" [disabled] [ref=e351]
          - button "n15, empty" [disabled] [ref=e352]
          - button "2L, o15, double letter, empty" [disabled] [ref=e353]:
            - generic [ref=e354]: 2L
    - paragraph [ref=e355]: "Bonus squares: 2L doubles a letter, 3L triples a letter, 2W doubles the word, 3W triples the word."
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