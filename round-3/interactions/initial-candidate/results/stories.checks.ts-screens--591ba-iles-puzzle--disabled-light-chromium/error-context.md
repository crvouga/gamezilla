# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-puzzle--disabled light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  68776 pixels (ratio 0.21 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-puzzle/disabled-light.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-puzzle/disabled-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 68776 pixels (ratio 0.21 of all image pixels) are different.
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
  - 68776 pixels (ratio 0.21 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e10]:
    - paragraph [ref=e11]: Score at least 20 points in one move.
    - status [ref=e12]: This attempt is read-only. Placement is unavailable.
    - group "Your rack" [ref=e13]:
      - button "A, 1 points" [disabled] [ref=e14]:
        - generic [ref=e15]: A
        - generic [ref=e16]: "1"
      - button "E, 1 points" [disabled] [ref=e17]:
        - generic [ref=e18]: E
        - generic [ref=e19]: "1"
      - button "S, 1 points" [disabled] [ref=e20]:
        - generic [ref=e21]: S
        - generic [ref=e22]: "1"
      - button "T, 1 points" [disabled] [ref=e23]:
        - generic [ref=e24]: T
        - generic [ref=e25]: "1"
      - button "Blank, 0 points" [disabled] [ref=e26]:
        - generic [ref=e27]: "0"
      - button "R, 1 points" [disabled] [ref=e28]:
        - generic [ref=e29]: R
        - generic [ref=e30]: "1"
      - button "N, 1 points" [disabled] [ref=e31]:
        - generic [ref=e32]: "N"
        - generic [ref=e33]: "1"
    - generic [ref=e34]:
      - button "Play word" [disabled] [ref=e35]:
        - paragraph [ref=e38]: Play word
      - button "Recall tiles" [disabled] [ref=e39]:
        - paragraph [ref=e42]: Recall tiles
    - generic [ref=e43]:
      - generic [ref=e44]:
        - button "Fit board" [pressed] [ref=e45] [cursor=pointer]:
          - paragraph [ref=e48]: Fit board
        - button "Enlarge board" [ref=e49] [cursor=pointer]:
          - paragraph [ref=e52]: Enlarge board
      - region "Scrollable word board" [ref=e53]:
        - group "Puzzle board, fifteen columns and fifteen rows" [ref=e54]:
          - generic [ref=e56]: a
          - generic [ref=e57]: b
          - generic [ref=e58]: c
          - generic [ref=e59]: d
          - generic [ref=e60]: e
          - generic [ref=e61]: f
          - generic [ref=e62]: g
          - generic [ref=e63]: h
          - generic [ref=e64]: i
          - generic [ref=e65]: j
          - generic [ref=e66]: k
          - generic [ref=e67]: l
          - generic [ref=e68]: m
          - generic [ref=e69]: "n"
          - generic [ref=e70]: o
          - generic [ref=e71]: "1"
          - button "2L, a1, double letter, empty" [disabled] [ref=e72]:
            - generic [ref=e73]: 2L
          - button "b1, empty" [disabled] [ref=e74]
          - button "c1, empty" [disabled] [ref=e75]
          - button "d1, empty" [disabled] [ref=e76]
          - button "3W, e1, triple word, empty" [disabled] [ref=e77]:
            - generic [ref=e78]: 3W
          - button "f1, empty" [disabled] [ref=e79]
          - button "g1, empty" [disabled] [ref=e80]
          - button "2L, h1, double letter, empty" [disabled] [ref=e81]:
            - generic [ref=e82]: 2L
          - button "i1, empty" [disabled] [ref=e83]
          - button "j1, empty" [disabled] [ref=e84]
          - button "3W, k1, triple word, empty" [disabled] [ref=e85]:
            - generic [ref=e86]: 3W
          - button "l1, empty" [disabled] [ref=e87]
          - button "m1, empty" [disabled] [ref=e88]
          - button "n1, empty" [disabled] [ref=e89]
          - button "2L, o1, double letter, empty" [disabled] [ref=e90]:
            - generic [ref=e91]: 2L
          - generic [ref=e92]: "2"
          - button "a2, empty" [disabled] [ref=e93]
          - button "b2, empty" [disabled] [ref=e94]
          - button "c2, empty" [disabled] [ref=e95]
          - button "2L, d2, double letter, empty" [disabled] [ref=e96]:
            - generic [ref=e97]: 2L
          - button "e2, empty" [disabled] [ref=e98]
          - button "f2, empty" [disabled] [ref=e99]
          - button "2W, g2, double word, empty" [disabled] [ref=e100]:
            - generic [ref=e101]: 2W
          - button "h2, empty" [disabled] [ref=e102]
          - button "2W, i2, double word, empty" [disabled] [ref=e103]:
            - generic [ref=e104]: 2W
          - button "j2, empty" [disabled] [ref=e105]
          - button "k2, empty" [disabled] [ref=e106]
          - button "2L, l2, double letter, empty" [disabled] [ref=e107]:
            - generic [ref=e108]: 2L
          - button "m2, empty" [disabled] [ref=e109]
          - button "n2, empty" [disabled] [ref=e110]
          - button "o2, empty" [disabled] [ref=e111]
          - generic [ref=e112]: "3"
          - button "a3, empty" [disabled] [ref=e113]
          - button "b3, empty" [disabled] [ref=e114]
          - button "c3, empty" [disabled] [ref=e115]
          - button "d3, empty" [disabled] [ref=e116]
          - button "3L, e3, triple letter, empty" [disabled] [ref=e117]:
            - generic [ref=e118]: 3L
          - button "f3, empty" [disabled] [ref=e119]
          - button "g3, empty" [disabled] [ref=e120]
          - button "h3, empty" [disabled] [ref=e121]
          - button "i3, empty" [disabled] [ref=e122]
          - button "j3, empty" [disabled] [ref=e123]
          - button "3L, k3, triple letter, empty" [disabled] [ref=e124]:
            - generic [ref=e125]: 3L
          - button "l3, empty" [disabled] [ref=e126]
          - button "m3, empty" [disabled] [ref=e127]
          - button "n3, empty" [disabled] [ref=e128]
          - button "o3, empty" [disabled] [ref=e129]
          - generic [ref=e130]: "4"
          - button "a4, empty" [disabled] [ref=e131]
          - button "2L, b4, double letter, empty" [disabled] [ref=e132]:
            - generic [ref=e133]: 2L
          - button "c4, empty" [disabled] [ref=e134]
          - button "2W, d4, double word, empty" [disabled] [ref=e135]:
            - generic [ref=e136]: 2W
          - button "e4, empty" [disabled] [ref=e137]
          - button "f4, empty" [disabled] [ref=e138]
          - button "g4, empty" [disabled] [ref=e139]
          - button "h4, empty" [disabled] [ref=e140]
          - button "i4, empty" [disabled] [ref=e141]
          - button "j4, empty" [disabled] [ref=e142]
          - button "k4, empty" [disabled] [ref=e143]
          - button "2W, l4, double word, empty" [disabled] [ref=e144]:
            - generic [ref=e145]: 2W
          - button "m4, empty" [disabled] [ref=e146]
          - button "2L, n4, double letter, empty" [disabled] [ref=e147]:
            - generic [ref=e148]: 2L
          - button "o4, empty" [disabled] [ref=e149]
          - generic [ref=e150]: "5"
          - button "3W, a5, triple word, empty" [disabled] [ref=e151]:
            - generic [ref=e152]: 3W
          - button "b5, empty" [disabled] [ref=e153]
          - button "3L, c5, triple letter, empty" [disabled] [ref=e154]:
            - generic [ref=e155]: 3L
          - button "d5, empty" [disabled] [ref=e156]
          - button "e5, empty" [disabled] [ref=e157]
          - button "f5, empty" [disabled] [ref=e158]
          - button "2L, g5, double letter, empty" [disabled] [ref=e159]:
            - generic [ref=e160]: 2L
          - button "h5, empty" [disabled] [ref=e161]
          - button "2L, i5, double letter, empty" [disabled] [ref=e162]:
            - generic [ref=e163]: 2L
          - button "j5, empty" [disabled] [ref=e164]
          - button "k5, empty" [disabled] [ref=e165]
          - button "l5, empty" [disabled] [ref=e166]
          - button "3L, m5, triple letter, empty" [disabled] [ref=e167]:
            - generic [ref=e168]: 3L
          - button "n5, empty" [disabled] [ref=e169]
          - button "3W, o5, triple word, empty" [disabled] [ref=e170]:
            - generic [ref=e171]: 3W
          - generic [ref=e172]: "6"
          - button "a6, empty" [disabled] [ref=e173]
          - button "b6, empty" [disabled] [ref=e174]
          - button "c6, empty" [disabled] [ref=e175]
          - button "d6, empty" [disabled] [ref=e176]
          - button "e6, empty" [disabled] [ref=e177]
          - button "f6, empty" [disabled] [ref=e178]
          - button "g6, empty" [disabled] [ref=e179]
          - button "3L, h6, triple letter, empty" [disabled] [ref=e180]:
            - generic [ref=e181]: 3L
          - button "i6, empty" [disabled] [ref=e182]
          - button "j6, empty" [disabled] [ref=e183]
          - button "k6, empty" [disabled] [ref=e184]
          - button "l6, empty" [disabled] [ref=e185]
          - button "m6, empty" [disabled] [ref=e186]
          - button "n6, empty" [disabled] [ref=e187]
          - button "o6, empty" [disabled] [ref=e188]
          - generic [ref=e189]: "7"
          - button "a7, empty" [disabled] [ref=e190]
          - button "2W, b7, double word, empty" [disabled] [ref=e191]:
            - generic [ref=e192]: 2W
          - button "c7, empty" [disabled] [ref=e193]
          - button "d7, empty" [disabled] [ref=e194]
          - button "2L, e7, double letter, empty" [disabled] [ref=e195]:
            - generic [ref=e196]: 2L
          - button "f7, empty" [disabled] [ref=e197]
          - button "2L, g7, double letter, empty" [disabled] [ref=e198]:
            - generic [ref=e199]: 2L
          - button "h7, empty" [disabled] [ref=e200]
          - button "2L, i7, double letter, empty" [disabled] [ref=e201]:
            - generic [ref=e202]: 2L
          - button "j7, empty" [disabled] [ref=e203]
          - button "2L, k7, double letter, empty" [disabled] [ref=e204]:
            - generic [ref=e205]: 2L
          - button "l7, empty" [disabled] [ref=e206]
          - button "m7, empty" [disabled] [ref=e207]
          - button "2W, n7, double word, empty" [disabled] [ref=e208]:
            - generic [ref=e209]: 2W
          - button "o7, empty" [disabled] [ref=e210]
          - generic [ref=e211]: "8"
          - button "2L, a8, double letter, empty" [disabled] [ref=e212]:
            - generic [ref=e213]: 2L
          - button "b8, empty" [disabled] [ref=e214]
          - button "c8, empty" [disabled] [ref=e215]
          - button "d8, empty" [disabled] [ref=e216]
          - button "e8, empty" [disabled] [ref=e217]
          - button "3L, f8, triple letter, empty" [disabled] [ref=e218]:
            - generic [ref=e219]: 3L
          - button "C 3, g8, committed" [disabled] [ref=e220]:
            - generic [ref=e221]: C
          - button "A 1, h8, committed" [disabled] [ref=e222]:
            - generic [ref=e223]: A
          - button "T 1, i8, committed" [disabled] [ref=e224]:
            - generic [ref=e225]: T
          - button "3L, j8, triple letter, empty" [disabled] [ref=e226]:
            - generic [ref=e227]: 3L
          - button "k8, empty" [disabled] [ref=e228]
          - button "l8, empty" [disabled] [ref=e229]
          - button "m8, empty" [disabled] [ref=e230]
          - button "n8, empty" [disabled] [ref=e231]
          - button "2L, o8, double letter, empty" [disabled] [ref=e232]:
            - generic [ref=e233]: 2L
          - generic [ref=e234]: "9"
          - button "a9, empty" [disabled] [ref=e235]
          - button "2W, b9, double word, empty" [disabled] [ref=e236]:
            - generic [ref=e237]: 2W
          - button "c9, empty" [disabled] [ref=e238]
          - button "d9, empty" [disabled] [ref=e239]
          - button "2L, e9, double letter, empty" [disabled] [ref=e240]:
            - generic [ref=e241]: 2L
          - button "f9, empty" [disabled] [ref=e242]
          - button "2L, g9, double letter, empty" [disabled] [ref=e243]:
            - generic [ref=e244]: 2L
          - button "h9, empty" [disabled] [ref=e245]
          - button "O 1, i9, committed" [disabled] [ref=e246]:
            - generic [ref=e247]: O
          - button "j9, empty" [disabled] [ref=e248]
          - button "2L, k9, double letter, empty" [disabled] [ref=e249]:
            - generic [ref=e250]: 2L
          - button "l9, empty" [disabled] [ref=e251]
          - button "m9, empty" [disabled] [ref=e252]
          - button "2W, n9, double word, empty" [disabled] [ref=e253]:
            - generic [ref=e254]: 2W
          - button "o9, empty" [disabled] [ref=e255]
          - generic [ref=e256]: "10"
          - button "a10, empty" [disabled] [ref=e257]
          - button "b10, empty" [disabled] [ref=e258]
          - button "c10, empty" [disabled] [ref=e259]
          - button "d10, empty" [disabled] [ref=e260]
          - button "e10, empty" [disabled] [ref=e261]
          - button "f10, empty" [disabled] [ref=e262]
          - button "g10, empty" [disabled] [ref=e263]
          - button "3L, h10, triple letter, empty" [disabled] [ref=e264]:
            - generic [ref=e265]: 3L
          - button "E 1, i10, committed" [disabled] [ref=e266]:
            - generic [ref=e267]: E
          - button "j10, empty" [disabled] [ref=e268]
          - button "k10, empty" [disabled] [ref=e269]
          - button "l10, empty" [disabled] [ref=e270]
          - button "m10, empty" [disabled] [ref=e271]
          - button "n10, empty" [disabled] [ref=e272]
          - button "o10, empty" [disabled] [ref=e273]
          - generic [ref=e274]: "11"
          - button "3W, a11, triple word, empty" [disabled] [ref=e275]:
            - generic [ref=e276]: 3W
          - button "b11, empty" [disabled] [ref=e277]
          - button "3L, c11, triple letter, empty" [disabled] [ref=e278]:
            - generic [ref=e279]: 3L
          - button "d11, empty" [disabled] [ref=e280]
          - button "e11, empty" [disabled] [ref=e281]
          - button "f11, empty" [disabled] [ref=e282]
          - button "2L, g11, double letter, empty" [disabled] [ref=e283]:
            - generic [ref=e284]: 2L
          - button "h11, empty" [disabled] [ref=e285]
          - button "2L, i11, double letter, empty" [disabled] [ref=e286]:
            - generic [ref=e287]: 2L
          - button "j11, empty" [disabled] [ref=e288]
          - button "k11, empty" [disabled] [ref=e289]
          - button "l11, empty" [disabled] [ref=e290]
          - button "3L, m11, triple letter, empty" [disabled] [ref=e291]:
            - generic [ref=e292]: 3L
          - button "n11, empty" [disabled] [ref=e293]
          - button "3W, o11, triple word, empty" [disabled] [ref=e294]:
            - generic [ref=e295]: 3W
          - generic [ref=e296]: "12"
          - button "a12, empty" [disabled] [ref=e297]
          - button "2L, b12, double letter, empty" [disabled] [ref=e298]:
            - generic [ref=e299]: 2L
          - button "c12, empty" [disabled] [ref=e300]
          - button "2W, d12, double word, empty" [disabled] [ref=e301]:
            - generic [ref=e302]: 2W
          - button "e12, empty" [disabled] [ref=e303]
          - button "f12, empty" [disabled] [ref=e304]
          - button "g12, empty" [disabled] [ref=e305]
          - button "h12, empty" [disabled] [ref=e306]
          - button "i12, empty" [disabled] [ref=e307]
          - button "j12, empty" [disabled] [ref=e308]
          - button "k12, empty" [disabled] [ref=e309]
          - button "2W, l12, double word, empty" [disabled] [ref=e310]:
            - generic [ref=e311]: 2W
          - button "m12, empty" [disabled] [ref=e312]
          - button "2L, n12, double letter, empty" [disabled] [ref=e313]:
            - generic [ref=e314]: 2L
          - button "o12, empty" [disabled] [ref=e315]
          - generic [ref=e316]: "13"
          - button "a13, empty" [disabled] [ref=e317]
          - button "b13, empty" [disabled] [ref=e318]
          - button "c13, empty" [disabled] [ref=e319]
          - button "d13, empty" [disabled] [ref=e320]
          - button "3L, e13, triple letter, empty" [disabled] [ref=e321]:
            - generic [ref=e322]: 3L
          - button "f13, empty" [disabled] [ref=e323]
          - button "g13, empty" [disabled] [ref=e324]
          - button "h13, empty" [disabled] [ref=e325]
          - button "i13, empty" [disabled] [ref=e326]
          - button "j13, empty" [disabled] [ref=e327]
          - button "3L, k13, triple letter, empty" [disabled] [ref=e328]:
            - generic [ref=e329]: 3L
          - button "l13, empty" [disabled] [ref=e330]
          - button "m13, empty" [disabled] [ref=e331]
          - button "n13, empty" [disabled] [ref=e332]
          - button "o13, empty" [disabled] [ref=e333]
          - generic [ref=e334]: "14"
          - button "a14, empty" [disabled] [ref=e335]
          - button "b14, empty" [disabled] [ref=e336]
          - button "c14, empty" [disabled] [ref=e337]
          - button "2L, d14, double letter, empty" [disabled] [ref=e338]:
            - generic [ref=e339]: 2L
          - button "e14, empty" [disabled] [ref=e340]
          - button "f14, empty" [disabled] [ref=e341]
          - button "2W, g14, double word, empty" [disabled] [ref=e342]:
            - generic [ref=e343]: 2W
          - button "h14, empty" [disabled] [ref=e344]
          - button "2W, i14, double word, empty" [disabled] [ref=e345]:
            - generic [ref=e346]: 2W
          - button "j14, empty" [disabled] [ref=e347]
          - button "k14, empty" [disabled] [ref=e348]
          - button "2L, l14, double letter, empty" [disabled] [ref=e349]:
            - generic [ref=e350]: 2L
          - button "m14, empty" [disabled] [ref=e351]
          - button "n14, empty" [disabled] [ref=e352]
          - button "o14, empty" [disabled] [ref=e353]
          - generic [ref=e354]: "15"
          - button "2L, a15, double letter, empty" [disabled] [ref=e355]:
            - generic [ref=e356]: 2L
          - button "b15, empty" [disabled] [ref=e357]
          - button "c15, empty" [disabled] [ref=e358]
          - button "d15, empty" [disabled] [ref=e359]
          - button "3W, e15, triple word, empty" [disabled] [ref=e360]:
            - generic [ref=e361]: 3W
          - button "f15, empty" [disabled] [ref=e362]
          - button "g15, empty" [disabled] [ref=e363]
          - button "2L, h15, double letter, empty" [disabled] [ref=e364]:
            - generic [ref=e365]: 2L
          - button "i15, empty" [disabled] [ref=e366]
          - button "j15, empty" [disabled] [ref=e367]
          - button "3W, k15, triple word, empty" [disabled] [ref=e368]:
            - generic [ref=e369]: 3W
          - button "l15, empty" [disabled] [ref=e370]
          - button "m15, empty" [disabled] [ref=e371]
          - button "n15, empty" [disabled] [ref=e372]
          - button "2L, o15, double letter, empty" [disabled] [ref=e373]:
            - generic [ref=e374]: 2L
    - paragraph [ref=e375]: "Bonus squares: 2L doubles a letter, 3L triples a letter, 2W doubles the word, 3W triples the word."
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