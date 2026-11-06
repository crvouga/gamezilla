# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-puzzle--disabled dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  161840 pixels (ratio 0.14 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-puzzle/disabled-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-puzzle/disabled-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 161840 pixels (ratio 0.14 of all image pixels) are different.
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
  - 161840 pixels (ratio 0.14 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e13]:
    - paragraph [ref=e14]: Score at least 20 points in one move.
    - status [ref=e15]: This attempt is read-only. Placement is unavailable.
    - generic [ref=e16]:
      - button "Play word" [disabled] [ref=e17]:
        - paragraph [ref=e20]: Play word
      - button "Recall tiles" [disabled] [ref=e21]:
        - paragraph [ref=e24]: Recall tiles
    - group "Your rack" [ref=e25]:
      - button "A, 1 points" [disabled] [ref=e26]:
        - generic [ref=e27]: A
        - generic [ref=e28]: "1"
      - button "E, 1 points" [disabled] [ref=e29]:
        - generic [ref=e30]: E
        - generic [ref=e31]: "1"
      - button "S, 1 points" [disabled] [ref=e32]:
        - generic [ref=e33]: S
        - generic [ref=e34]: "1"
      - button "T, 1 points" [disabled] [ref=e35]:
        - generic [ref=e36]: T
        - generic [ref=e37]: "1"
      - button "Blank, 0 points" [disabled] [ref=e38]:
        - generic [ref=e39]: "0"
      - button "R, 1 points" [disabled] [ref=e40]:
        - generic [ref=e41]: R
        - generic [ref=e42]: "1"
      - button "N, 1 points" [disabled] [ref=e43]:
        - generic [ref=e44]: "N"
        - generic [ref=e45]: "1"
    - paragraph [ref=e46]: "2L/3L: double/triple letter. 2W/3W: double/triple word."
    - generic [ref=e47]:
      - generic [ref=e48]:
        - button "Fit board" [pressed] [ref=e49] [cursor=pointer]:
          - paragraph [ref=e52]: Fit board
        - button "Enlarge board" [ref=e53] [cursor=pointer]:
          - paragraph [ref=e56]: Enlarge board
      - region "Scrollable word board" [ref=e58]:
        - group "Puzzle board, fifteen columns and fifteen rows" [ref=e59]:
          - generic [ref=e61]: a
          - generic [ref=e62]: b
          - generic [ref=e63]: c
          - generic [ref=e64]: d
          - generic [ref=e65]: e
          - generic [ref=e66]: f
          - generic [ref=e67]: g
          - generic [ref=e68]: h
          - generic [ref=e69]: i
          - generic [ref=e70]: j
          - generic [ref=e71]: k
          - generic [ref=e72]: l
          - generic [ref=e73]: m
          - generic [ref=e74]: "n"
          - generic [ref=e75]: o
          - generic [ref=e76]: "1"
          - button "2L, a1, double letter, empty" [disabled] [ref=e77]:
            - generic [ref=e78]: 2L
          - button "b1, empty" [disabled] [ref=e79]
          - button "c1, empty" [disabled] [ref=e80]
          - button "d1, empty" [disabled] [ref=e81]
          - button "3W, e1, triple word, empty" [disabled] [ref=e82]:
            - generic [ref=e83]: 3W
          - button "f1, empty" [disabled] [ref=e84]
          - button "g1, empty" [disabled] [ref=e85]
          - button "2L, h1, double letter, empty" [disabled] [ref=e86]:
            - generic [ref=e87]: 2L
          - button "i1, empty" [disabled] [ref=e88]
          - button "j1, empty" [disabled] [ref=e89]
          - button "3W, k1, triple word, empty" [disabled] [ref=e90]:
            - generic [ref=e91]: 3W
          - button "l1, empty" [disabled] [ref=e92]
          - button "m1, empty" [disabled] [ref=e93]
          - button "n1, empty" [disabled] [ref=e94]
          - button "2L, o1, double letter, empty" [disabled] [ref=e95]:
            - generic [ref=e96]: 2L
          - generic [ref=e97]: "2"
          - button "a2, empty" [disabled] [ref=e98]
          - button "b2, empty" [disabled] [ref=e99]
          - button "c2, empty" [disabled] [ref=e100]
          - button "2L, d2, double letter, empty" [disabled] [ref=e101]:
            - generic [ref=e102]: 2L
          - button "e2, empty" [disabled] [ref=e103]
          - button "f2, empty" [disabled] [ref=e104]
          - button "2W, g2, double word, empty" [disabled] [ref=e105]:
            - generic [ref=e106]: 2W
          - button "h2, empty" [disabled] [ref=e107]
          - button "2W, i2, double word, empty" [disabled] [ref=e108]:
            - generic [ref=e109]: 2W
          - button "j2, empty" [disabled] [ref=e110]
          - button "k2, empty" [disabled] [ref=e111]
          - button "2L, l2, double letter, empty" [disabled] [ref=e112]:
            - generic [ref=e113]: 2L
          - button "m2, empty" [disabled] [ref=e114]
          - button "n2, empty" [disabled] [ref=e115]
          - button "o2, empty" [disabled] [ref=e116]
          - generic [ref=e117]: "3"
          - button "a3, empty" [disabled] [ref=e118]
          - button "b3, empty" [disabled] [ref=e119]
          - button "c3, empty" [disabled] [ref=e120]
          - button "d3, empty" [disabled] [ref=e121]
          - button "3L, e3, triple letter, empty" [disabled] [ref=e122]:
            - generic [ref=e123]: 3L
          - button "f3, empty" [disabled] [ref=e124]
          - button "g3, empty" [disabled] [ref=e125]
          - button "h3, empty" [disabled] [ref=e126]
          - button "i3, empty" [disabled] [ref=e127]
          - button "j3, empty" [disabled] [ref=e128]
          - button "3L, k3, triple letter, empty" [disabled] [ref=e129]:
            - generic [ref=e130]: 3L
          - button "l3, empty" [disabled] [ref=e131]
          - button "m3, empty" [disabled] [ref=e132]
          - button "n3, empty" [disabled] [ref=e133]
          - button "o3, empty" [disabled] [ref=e134]
          - generic [ref=e135]: "4"
          - button "a4, empty" [disabled] [ref=e136]
          - button "2L, b4, double letter, empty" [disabled] [ref=e137]:
            - generic [ref=e138]: 2L
          - button "c4, empty" [disabled] [ref=e139]
          - button "2W, d4, double word, empty" [disabled] [ref=e140]:
            - generic [ref=e141]: 2W
          - button "e4, empty" [disabled] [ref=e142]
          - button "f4, empty" [disabled] [ref=e143]
          - button "g4, empty" [disabled] [ref=e144]
          - button "h4, empty" [disabled] [ref=e145]
          - button "i4, empty" [disabled] [ref=e146]
          - button "j4, empty" [disabled] [ref=e147]
          - button "k4, empty" [disabled] [ref=e148]
          - button "2W, l4, double word, empty" [disabled] [ref=e149]:
            - generic [ref=e150]: 2W
          - button "m4, empty" [disabled] [ref=e151]
          - button "2L, n4, double letter, empty" [disabled] [ref=e152]:
            - generic [ref=e153]: 2L
          - button "o4, empty" [disabled] [ref=e154]
          - generic [ref=e155]: "5"
          - button "3W, a5, triple word, empty" [disabled] [ref=e156]:
            - generic [ref=e157]: 3W
          - button "b5, empty" [disabled] [ref=e158]
          - button "3L, c5, triple letter, empty" [disabled] [ref=e159]:
            - generic [ref=e160]: 3L
          - button "d5, empty" [disabled] [ref=e161]
          - button "e5, empty" [disabled] [ref=e162]
          - button "f5, empty" [disabled] [ref=e163]
          - button "2L, g5, double letter, empty" [disabled] [ref=e164]:
            - generic [ref=e165]: 2L
          - button "h5, empty" [disabled] [ref=e166]
          - button "2L, i5, double letter, empty" [disabled] [ref=e167]:
            - generic [ref=e168]: 2L
          - button "j5, empty" [disabled] [ref=e169]
          - button "k5, empty" [disabled] [ref=e170]
          - button "l5, empty" [disabled] [ref=e171]
          - button "3L, m5, triple letter, empty" [disabled] [ref=e172]:
            - generic [ref=e173]: 3L
          - button "n5, empty" [disabled] [ref=e174]
          - button "3W, o5, triple word, empty" [disabled] [ref=e175]:
            - generic [ref=e176]: 3W
          - generic [ref=e177]: "6"
          - button "a6, empty" [disabled] [ref=e178]
          - button "b6, empty" [disabled] [ref=e179]
          - button "c6, empty" [disabled] [ref=e180]
          - button "d6, empty" [disabled] [ref=e181]
          - button "e6, empty" [disabled] [ref=e182]
          - button "f6, empty" [disabled] [ref=e183]
          - button "g6, empty" [disabled] [ref=e184]
          - button "3L, h6, triple letter, empty" [disabled] [ref=e185]:
            - generic [ref=e186]: 3L
          - button "i6, empty" [disabled] [ref=e187]
          - button "j6, empty" [disabled] [ref=e188]
          - button "k6, empty" [disabled] [ref=e189]
          - button "l6, empty" [disabled] [ref=e190]
          - button "m6, empty" [disabled] [ref=e191]
          - button "n6, empty" [disabled] [ref=e192]
          - button "o6, empty" [disabled] [ref=e193]
          - generic [ref=e194]: "7"
          - button "a7, empty" [disabled] [ref=e195]
          - button "2W, b7, double word, empty" [disabled] [ref=e196]:
            - generic [ref=e197]: 2W
          - button "c7, empty" [disabled] [ref=e198]
          - button "d7, empty" [disabled] [ref=e199]
          - button "2L, e7, double letter, empty" [disabled] [ref=e200]:
            - generic [ref=e201]: 2L
          - button "f7, empty" [disabled] [ref=e202]
          - button "2L, g7, double letter, empty" [disabled] [ref=e203]:
            - generic [ref=e204]: 2L
          - button "h7, empty" [disabled] [ref=e205]
          - button "2L, i7, double letter, empty" [disabled] [ref=e206]:
            - generic [ref=e207]: 2L
          - button "j7, empty" [disabled] [ref=e208]
          - button "2L, k7, double letter, empty" [disabled] [ref=e209]:
            - generic [ref=e210]: 2L
          - button "l7, empty" [disabled] [ref=e211]
          - button "m7, empty" [disabled] [ref=e212]
          - button "2W, n7, double word, empty" [disabled] [ref=e213]:
            - generic [ref=e214]: 2W
          - button "o7, empty" [disabled] [ref=e215]
          - generic [ref=e216]: "8"
          - button "2L, a8, double letter, empty" [disabled] [ref=e217]:
            - generic [ref=e218]: 2L
          - button "b8, empty" [disabled] [ref=e219]
          - button "c8, empty" [disabled] [ref=e220]
          - button "d8, empty" [disabled] [ref=e221]
          - button "e8, empty" [disabled] [ref=e222]
          - button "3L, f8, triple letter, empty" [disabled] [ref=e223]:
            - generic [ref=e224]: 3L
          - button "C 3, g8, committed" [disabled] [ref=e225]:
            - generic [ref=e226]: C
            - generic [ref=e227]: "3"
          - button "A 1, h8, committed" [disabled] [ref=e228]:
            - generic [ref=e229]: A
            - generic [ref=e230]: "1"
          - button "T 1, i8, committed" [disabled] [ref=e231]:
            - generic [ref=e232]: T
            - generic [ref=e233]: "1"
          - button "3L, j8, triple letter, empty" [disabled] [ref=e234]:
            - generic [ref=e235]: 3L
          - button "k8, empty" [disabled] [ref=e236]
          - button "l8, empty" [disabled] [ref=e237]
          - button "m8, empty" [disabled] [ref=e238]
          - button "n8, empty" [disabled] [ref=e239]
          - button "2L, o8, double letter, empty" [disabled] [ref=e240]:
            - generic [ref=e241]: 2L
          - generic [ref=e242]: "9"
          - button "a9, empty" [disabled] [ref=e243]
          - button "2W, b9, double word, empty" [disabled] [ref=e244]:
            - generic [ref=e245]: 2W
          - button "c9, empty" [disabled] [ref=e246]
          - button "d9, empty" [disabled] [ref=e247]
          - button "2L, e9, double letter, empty" [disabled] [ref=e248]:
            - generic [ref=e249]: 2L
          - button "f9, empty" [disabled] [ref=e250]
          - button "2L, g9, double letter, empty" [disabled] [ref=e251]:
            - generic [ref=e252]: 2L
          - button "h9, empty" [disabled] [ref=e253]
          - button "O 1, i9, committed" [disabled] [ref=e254]:
            - generic [ref=e255]: O
            - generic [ref=e256]: "1"
          - button "j9, empty" [disabled] [ref=e257]
          - button "2L, k9, double letter, empty" [disabled] [ref=e258]:
            - generic [ref=e259]: 2L
          - button "l9, empty" [disabled] [ref=e260]
          - button "m9, empty" [disabled] [ref=e261]
          - button "2W, n9, double word, empty" [disabled] [ref=e262]:
            - generic [ref=e263]: 2W
          - button "o9, empty" [disabled] [ref=e264]
          - generic [ref=e265]: "10"
          - button "a10, empty" [disabled] [ref=e266]
          - button "b10, empty" [disabled] [ref=e267]
          - button "c10, empty" [disabled] [ref=e268]
          - button "d10, empty" [disabled] [ref=e269]
          - button "e10, empty" [disabled] [ref=e270]
          - button "f10, empty" [disabled] [ref=e271]
          - button "g10, empty" [disabled] [ref=e272]
          - button "3L, h10, triple letter, empty" [disabled] [ref=e273]:
            - generic [ref=e274]: 3L
          - button "E 1, i10, committed" [disabled] [ref=e275]:
            - generic [ref=e276]: E
            - generic [ref=e277]: "1"
          - button "j10, empty" [disabled] [ref=e278]
          - button "k10, empty" [disabled] [ref=e279]
          - button "l10, empty" [disabled] [ref=e280]
          - button "m10, empty" [disabled] [ref=e281]
          - button "n10, empty" [disabled] [ref=e282]
          - button "o10, empty" [disabled] [ref=e283]
          - generic [ref=e284]: "11"
          - button "3W, a11, triple word, empty" [disabled] [ref=e285]:
            - generic [ref=e286]: 3W
          - button "b11, empty" [disabled] [ref=e287]
          - button "3L, c11, triple letter, empty" [disabled] [ref=e288]:
            - generic [ref=e289]: 3L
          - button "d11, empty" [disabled] [ref=e290]
          - button "e11, empty" [disabled] [ref=e291]
          - button "f11, empty" [disabled] [ref=e292]
          - button "2L, g11, double letter, empty" [disabled] [ref=e293]:
            - generic [ref=e294]: 2L
          - button "h11, empty" [disabled] [ref=e295]
          - button "2L, i11, double letter, empty" [disabled] [ref=e296]:
            - generic [ref=e297]: 2L
          - button "j11, empty" [disabled] [ref=e298]
          - button "k11, empty" [disabled] [ref=e299]
          - button "l11, empty" [disabled] [ref=e300]
          - button "3L, m11, triple letter, empty" [disabled] [ref=e301]:
            - generic [ref=e302]: 3L
          - button "n11, empty" [disabled] [ref=e303]
          - button "3W, o11, triple word, empty" [disabled] [ref=e304]:
            - generic [ref=e305]: 3W
          - generic [ref=e306]: "12"
          - button "a12, empty" [disabled] [ref=e307]
          - button "2L, b12, double letter, empty" [disabled] [ref=e308]:
            - generic [ref=e309]: 2L
          - button "c12, empty" [disabled] [ref=e310]
          - button "2W, d12, double word, empty" [disabled] [ref=e311]:
            - generic [ref=e312]: 2W
          - button "e12, empty" [disabled] [ref=e313]
          - button "f12, empty" [disabled] [ref=e314]
          - button "g12, empty" [disabled] [ref=e315]
          - button "h12, empty" [disabled] [ref=e316]
          - button "i12, empty" [disabled] [ref=e317]
          - button "j12, empty" [disabled] [ref=e318]
          - button "k12, empty" [disabled] [ref=e319]
          - button "2W, l12, double word, empty" [disabled] [ref=e320]:
            - generic [ref=e321]: 2W
          - button "m12, empty" [disabled] [ref=e322]
          - button "2L, n12, double letter, empty" [disabled] [ref=e323]:
            - generic [ref=e324]: 2L
          - button "o12, empty" [disabled] [ref=e325]
          - generic [ref=e326]: "13"
          - button "a13, empty" [disabled] [ref=e327]
          - button "b13, empty" [disabled] [ref=e328]
          - button "c13, empty" [disabled] [ref=e329]
          - button "d13, empty" [disabled] [ref=e330]
          - button "3L, e13, triple letter, empty" [disabled] [ref=e331]:
            - generic [ref=e332]: 3L
          - button "f13, empty" [disabled] [ref=e333]
          - button "g13, empty" [disabled] [ref=e334]
          - button "h13, empty" [disabled] [ref=e335]
          - button "i13, empty" [disabled] [ref=e336]
          - button "j13, empty" [disabled] [ref=e337]
          - button "3L, k13, triple letter, empty" [disabled] [ref=e338]:
            - generic [ref=e339]: 3L
          - button "l13, empty" [disabled] [ref=e340]
          - button "m13, empty" [disabled] [ref=e341]
          - button "n13, empty" [disabled] [ref=e342]
          - button "o13, empty" [disabled] [ref=e343]
          - generic [ref=e344]: "14"
          - button "a14, empty" [disabled] [ref=e345]
          - button "b14, empty" [disabled] [ref=e346]
          - button "c14, empty" [disabled] [ref=e347]
          - button "2L, d14, double letter, empty" [disabled] [ref=e348]:
            - generic [ref=e349]: 2L
          - button "e14, empty" [disabled] [ref=e350]
          - button "f14, empty" [disabled] [ref=e351]
          - button "2W, g14, double word, empty" [disabled] [ref=e352]:
            - generic [ref=e353]: 2W
          - button "h14, empty" [disabled] [ref=e354]
          - button "2W, i14, double word, empty" [disabled] [ref=e355]:
            - generic [ref=e356]: 2W
          - button "j14, empty" [disabled] [ref=e357]
          - button "k14, empty" [disabled] [ref=e358]
          - button "2L, l14, double letter, empty" [disabled] [ref=e359]:
            - generic [ref=e360]: 2L
          - button "m14, empty" [disabled] [ref=e361]
          - button "n14, empty" [disabled] [ref=e362]
          - button "o14, empty" [disabled] [ref=e363]
          - generic [ref=e364]: "15"
          - button "2L, a15, double letter, empty" [disabled] [ref=e365]:
            - generic [ref=e366]: 2L
          - button "b15, empty" [disabled] [ref=e367]
          - button "c15, empty" [disabled] [ref=e368]
          - button "d15, empty" [disabled] [ref=e369]
          - button "3W, e15, triple word, empty" [disabled] [ref=e370]:
            - generic [ref=e371]: 3W
          - button "f15, empty" [disabled] [ref=e372]
          - button "g15, empty" [disabled] [ref=e373]
          - button "2L, h15, double letter, empty" [disabled] [ref=e374]:
            - generic [ref=e375]: 2L
          - button "i15, empty" [disabled] [ref=e376]
          - button "j15, empty" [disabled] [ref=e377]
          - button "3W, k15, triple word, empty" [disabled] [ref=e378]:
            - generic [ref=e379]: 3W
          - button "l15, empty" [disabled] [ref=e380]
          - button "m15, empty" [disabled] [ref=e381]
          - button "n15, empty" [disabled] [ref=e382]
          - button "2L, o15, double letter, empty" [disabled] [ref=e383]:
            - generic [ref=e384]: 2L
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