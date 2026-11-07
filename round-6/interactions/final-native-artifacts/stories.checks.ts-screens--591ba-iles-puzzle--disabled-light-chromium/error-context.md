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
  78470 pixels (ratio 0.24 of all image pixels) are different.

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
  - 78470 pixels (ratio 0.24 of all image pixels) are different.
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
  - 78470 pixels (ratio 0.24 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e10]:
    - paragraph [ref=e11]: Score at least 20 points in one move.
    - status [ref=e12]: This attempt is read-only. Placement is unavailable.
    - generic [ref=e13]:
      - button "Play word" [disabled] [ref=e14]:
        - paragraph [ref=e17]: Play word
      - button "Recall tiles" [disabled] [ref=e18]:
        - paragraph [ref=e21]: Recall tiles
    - group "Your rack" [ref=e22]:
      - button "A, 1 points" [disabled] [ref=e23]:
        - generic [ref=e24]: A
        - generic [ref=e25]: "1"
      - button "E, 1 points" [disabled] [ref=e26]:
        - generic [ref=e27]: E
        - generic [ref=e28]: "1"
      - button "S, 1 points" [disabled] [ref=e29]:
        - generic [ref=e30]: S
        - generic [ref=e31]: "1"
      - button "T, 1 points" [disabled] [ref=e32]:
        - generic [ref=e33]: T
        - generic [ref=e34]: "1"
      - button "Blank, 0 points" [disabled] [ref=e35]:
        - generic [ref=e36]: "0"
      - button "R, 1 points" [disabled] [ref=e37]:
        - generic [ref=e38]: R
        - generic [ref=e39]: "1"
      - button "N, 1 points" [disabled] [ref=e40]:
        - generic [ref=e41]: "N"
        - generic [ref=e42]: "1"
    - paragraph [ref=e43]: "2L/3L: double/triple letter. 2W/3W: double/triple word."
    - generic [ref=e44]:
      - generic [ref=e45]:
        - button "Fit board" [pressed] [ref=e46] [cursor=pointer]:
          - paragraph [ref=e49]: Fit board
        - button "Enlarge board" [ref=e50] [cursor=pointer]:
          - paragraph [ref=e53]: Enlarge board
      - region "Scrollable word board" [ref=e55]:
        - group "Puzzle board, fifteen columns and fifteen rows" [ref=e56]:
          - generic [ref=e58]: a
          - generic [ref=e59]: b
          - generic [ref=e60]: c
          - generic [ref=e61]: d
          - generic [ref=e62]: e
          - generic [ref=e63]: f
          - generic [ref=e64]: g
          - generic [ref=e65]: h
          - generic [ref=e66]: i
          - generic [ref=e67]: j
          - generic [ref=e68]: k
          - generic [ref=e69]: l
          - generic [ref=e70]: m
          - generic [ref=e71]: "n"
          - generic [ref=e72]: o
          - generic [ref=e73]: "1"
          - button "2L, a1, double letter, empty" [disabled] [ref=e74]:
            - generic [ref=e75]: 2L
          - button "b1, empty" [disabled] [ref=e76]
          - button "c1, empty" [disabled] [ref=e77]
          - button "d1, empty" [disabled] [ref=e78]
          - button "3W, e1, triple word, empty" [disabled] [ref=e79]:
            - generic [ref=e80]: 3W
          - button "f1, empty" [disabled] [ref=e81]
          - button "g1, empty" [disabled] [ref=e82]
          - button "2L, h1, double letter, empty" [disabled] [ref=e83]:
            - generic [ref=e84]: 2L
          - button "i1, empty" [disabled] [ref=e85]
          - button "j1, empty" [disabled] [ref=e86]
          - button "3W, k1, triple word, empty" [disabled] [ref=e87]:
            - generic [ref=e88]: 3W
          - button "l1, empty" [disabled] [ref=e89]
          - button "m1, empty" [disabled] [ref=e90]
          - button "n1, empty" [disabled] [ref=e91]
          - button "2L, o1, double letter, empty" [disabled] [ref=e92]:
            - generic [ref=e93]: 2L
          - generic [ref=e94]: "2"
          - button "a2, empty" [disabled] [ref=e95]
          - button "b2, empty" [disabled] [ref=e96]
          - button "c2, empty" [disabled] [ref=e97]
          - button "2L, d2, double letter, empty" [disabled] [ref=e98]:
            - generic [ref=e99]: 2L
          - button "e2, empty" [disabled] [ref=e100]
          - button "f2, empty" [disabled] [ref=e101]
          - button "2W, g2, double word, empty" [disabled] [ref=e102]:
            - generic [ref=e103]: 2W
          - button "h2, empty" [disabled] [ref=e104]
          - button "2W, i2, double word, empty" [disabled] [ref=e105]:
            - generic [ref=e106]: 2W
          - button "j2, empty" [disabled] [ref=e107]
          - button "k2, empty" [disabled] [ref=e108]
          - button "2L, l2, double letter, empty" [disabled] [ref=e109]:
            - generic [ref=e110]: 2L
          - button "m2, empty" [disabled] [ref=e111]
          - button "n2, empty" [disabled] [ref=e112]
          - button "o2, empty" [disabled] [ref=e113]
          - generic [ref=e114]: "3"
          - button "a3, empty" [disabled] [ref=e115]
          - button "b3, empty" [disabled] [ref=e116]
          - button "c3, empty" [disabled] [ref=e117]
          - button "d3, empty" [disabled] [ref=e118]
          - button "3L, e3, triple letter, empty" [disabled] [ref=e119]:
            - generic [ref=e120]: 3L
          - button "f3, empty" [disabled] [ref=e121]
          - button "g3, empty" [disabled] [ref=e122]
          - button "h3, empty" [disabled] [ref=e123]
          - button "i3, empty" [disabled] [ref=e124]
          - button "j3, empty" [disabled] [ref=e125]
          - button "3L, k3, triple letter, empty" [disabled] [ref=e126]:
            - generic [ref=e127]: 3L
          - button "l3, empty" [disabled] [ref=e128]
          - button "m3, empty" [disabled] [ref=e129]
          - button "n3, empty" [disabled] [ref=e130]
          - button "o3, empty" [disabled] [ref=e131]
          - generic [ref=e132]: "4"
          - button "a4, empty" [disabled] [ref=e133]
          - button "2L, b4, double letter, empty" [disabled] [ref=e134]:
            - generic [ref=e135]: 2L
          - button "c4, empty" [disabled] [ref=e136]
          - button "2W, d4, double word, empty" [disabled] [ref=e137]:
            - generic [ref=e138]: 2W
          - button "e4, empty" [disabled] [ref=e139]
          - button "f4, empty" [disabled] [ref=e140]
          - button "g4, empty" [disabled] [ref=e141]
          - button "h4, empty" [disabled] [ref=e142]
          - button "i4, empty" [disabled] [ref=e143]
          - button "j4, empty" [disabled] [ref=e144]
          - button "k4, empty" [disabled] [ref=e145]
          - button "2W, l4, double word, empty" [disabled] [ref=e146]:
            - generic [ref=e147]: 2W
          - button "m4, empty" [disabled] [ref=e148]
          - button "2L, n4, double letter, empty" [disabled] [ref=e149]:
            - generic [ref=e150]: 2L
          - button "o4, empty" [disabled] [ref=e151]
          - generic [ref=e152]: "5"
          - button "3W, a5, triple word, empty" [disabled] [ref=e153]:
            - generic [ref=e154]: 3W
          - button "b5, empty" [disabled] [ref=e155]
          - button "3L, c5, triple letter, empty" [disabled] [ref=e156]:
            - generic [ref=e157]: 3L
          - button "d5, empty" [disabled] [ref=e158]
          - button "e5, empty" [disabled] [ref=e159]
          - button "f5, empty" [disabled] [ref=e160]
          - button "2L, g5, double letter, empty" [disabled] [ref=e161]:
            - generic [ref=e162]: 2L
          - button "h5, empty" [disabled] [ref=e163]
          - button "2L, i5, double letter, empty" [disabled] [ref=e164]:
            - generic [ref=e165]: 2L
          - button "j5, empty" [disabled] [ref=e166]
          - button "k5, empty" [disabled] [ref=e167]
          - button "l5, empty" [disabled] [ref=e168]
          - button "3L, m5, triple letter, empty" [disabled] [ref=e169]:
            - generic [ref=e170]: 3L
          - button "n5, empty" [disabled] [ref=e171]
          - button "3W, o5, triple word, empty" [disabled] [ref=e172]:
            - generic [ref=e173]: 3W
          - generic [ref=e174]: "6"
          - button "a6, empty" [disabled] [ref=e175]
          - button "b6, empty" [disabled] [ref=e176]
          - button "c6, empty" [disabled] [ref=e177]
          - button "d6, empty" [disabled] [ref=e178]
          - button "e6, empty" [disabled] [ref=e179]
          - button "f6, empty" [disabled] [ref=e180]
          - button "g6, empty" [disabled] [ref=e181]
          - button "3L, h6, triple letter, empty" [disabled] [ref=e182]:
            - generic [ref=e183]: 3L
          - button "i6, empty" [disabled] [ref=e184]
          - button "j6, empty" [disabled] [ref=e185]
          - button "k6, empty" [disabled] [ref=e186]
          - button "l6, empty" [disabled] [ref=e187]
          - button "m6, empty" [disabled] [ref=e188]
          - button "n6, empty" [disabled] [ref=e189]
          - button "o6, empty" [disabled] [ref=e190]
          - generic [ref=e191]: "7"
          - button "a7, empty" [disabled] [ref=e192]
          - button "2W, b7, double word, empty" [disabled] [ref=e193]:
            - generic [ref=e194]: 2W
          - button "c7, empty" [disabled] [ref=e195]
          - button "d7, empty" [disabled] [ref=e196]
          - button "2L, e7, double letter, empty" [disabled] [ref=e197]:
            - generic [ref=e198]: 2L
          - button "f7, empty" [disabled] [ref=e199]
          - button "2L, g7, double letter, empty" [disabled] [ref=e200]:
            - generic [ref=e201]: 2L
          - button "h7, empty" [disabled] [ref=e202]
          - button "2L, i7, double letter, empty" [disabled] [ref=e203]:
            - generic [ref=e204]: 2L
          - button "j7, empty" [disabled] [ref=e205]
          - button "2L, k7, double letter, empty" [disabled] [ref=e206]:
            - generic [ref=e207]: 2L
          - button "l7, empty" [disabled] [ref=e208]
          - button "m7, empty" [disabled] [ref=e209]
          - button "2W, n7, double word, empty" [disabled] [ref=e210]:
            - generic [ref=e211]: 2W
          - button "o7, empty" [disabled] [ref=e212]
          - generic [ref=e213]: "8"
          - button "2L, a8, double letter, empty" [disabled] [ref=e214]:
            - generic [ref=e215]: 2L
          - button "b8, empty" [disabled] [ref=e216]
          - button "c8, empty" [disabled] [ref=e217]
          - button "d8, empty" [disabled] [ref=e218]
          - button "e8, empty" [disabled] [ref=e219]
          - button "3L, f8, triple letter, empty" [disabled] [ref=e220]:
            - generic [ref=e221]: 3L
          - button "C 3, g8, committed" [disabled] [ref=e222]:
            - generic [ref=e223]: C
          - button "A 1, h8, committed" [disabled] [ref=e224]:
            - generic [ref=e225]: A
          - button "T 1, i8, committed" [disabled] [ref=e226]:
            - generic [ref=e227]: T
          - button "3L, j8, triple letter, empty" [disabled] [ref=e228]:
            - generic [ref=e229]: 3L
          - button "k8, empty" [disabled] [ref=e230]
          - button "l8, empty" [disabled] [ref=e231]
          - button "m8, empty" [disabled] [ref=e232]
          - button "n8, empty" [disabled] [ref=e233]
          - button "2L, o8, double letter, empty" [disabled] [ref=e234]:
            - generic [ref=e235]: 2L
          - generic [ref=e236]: "9"
          - button "a9, empty" [disabled] [ref=e237]
          - button "2W, b9, double word, empty" [disabled] [ref=e238]:
            - generic [ref=e239]: 2W
          - button "c9, empty" [disabled] [ref=e240]
          - button "d9, empty" [disabled] [ref=e241]
          - button "2L, e9, double letter, empty" [disabled] [ref=e242]:
            - generic [ref=e243]: 2L
          - button "f9, empty" [disabled] [ref=e244]
          - button "2L, g9, double letter, empty" [disabled] [ref=e245]:
            - generic [ref=e246]: 2L
          - button "h9, empty" [disabled] [ref=e247]
          - button "O 1, i9, committed" [disabled] [ref=e248]:
            - generic [ref=e249]: O
          - button "j9, empty" [disabled] [ref=e250]
          - button "2L, k9, double letter, empty" [disabled] [ref=e251]:
            - generic [ref=e252]: 2L
          - button "l9, empty" [disabled] [ref=e253]
          - button "m9, empty" [disabled] [ref=e254]
          - button "2W, n9, double word, empty" [disabled] [ref=e255]:
            - generic [ref=e256]: 2W
          - button "o9, empty" [disabled] [ref=e257]
          - generic [ref=e258]: "10"
          - button "a10, empty" [disabled] [ref=e259]
          - button "b10, empty" [disabled] [ref=e260]
          - button "c10, empty" [disabled] [ref=e261]
          - button "d10, empty" [disabled] [ref=e262]
          - button "e10, empty" [disabled] [ref=e263]
          - button "f10, empty" [disabled] [ref=e264]
          - button "g10, empty" [disabled] [ref=e265]
          - button "3L, h10, triple letter, empty" [disabled] [ref=e266]:
            - generic [ref=e267]: 3L
          - button "E 1, i10, committed" [disabled] [ref=e268]:
            - generic [ref=e269]: E
          - button "j10, empty" [disabled] [ref=e270]
          - button "k10, empty" [disabled] [ref=e271]
          - button "l10, empty" [disabled] [ref=e272]
          - button "m10, empty" [disabled] [ref=e273]
          - button "n10, empty" [disabled] [ref=e274]
          - button "o10, empty" [disabled] [ref=e275]
          - generic [ref=e276]: "11"
          - button "3W, a11, triple word, empty" [disabled] [ref=e277]:
            - generic [ref=e278]: 3W
          - button "b11, empty" [disabled] [ref=e279]
          - button "3L, c11, triple letter, empty" [disabled] [ref=e280]:
            - generic [ref=e281]: 3L
          - button "d11, empty" [disabled] [ref=e282]
          - button "e11, empty" [disabled] [ref=e283]
          - button "f11, empty" [disabled] [ref=e284]
          - button "2L, g11, double letter, empty" [disabled] [ref=e285]:
            - generic [ref=e286]: 2L
          - button "h11, empty" [disabled] [ref=e287]
          - button "2L, i11, double letter, empty" [disabled] [ref=e288]:
            - generic [ref=e289]: 2L
          - button "j11, empty" [disabled] [ref=e290]
          - button "k11, empty" [disabled] [ref=e291]
          - button "l11, empty" [disabled] [ref=e292]
          - button "3L, m11, triple letter, empty" [disabled] [ref=e293]:
            - generic [ref=e294]: 3L
          - button "n11, empty" [disabled] [ref=e295]
          - button "3W, o11, triple word, empty" [disabled] [ref=e296]:
            - generic [ref=e297]: 3W
          - generic [ref=e298]: "12"
          - button "a12, empty" [disabled] [ref=e299]
          - button "2L, b12, double letter, empty" [disabled] [ref=e300]:
            - generic [ref=e301]: 2L
          - button "c12, empty" [disabled] [ref=e302]
          - button "2W, d12, double word, empty" [disabled] [ref=e303]:
            - generic [ref=e304]: 2W
          - button "e12, empty" [disabled] [ref=e305]
          - button "f12, empty" [disabled] [ref=e306]
          - button "g12, empty" [disabled] [ref=e307]
          - button "h12, empty" [disabled] [ref=e308]
          - button "i12, empty" [disabled] [ref=e309]
          - button "j12, empty" [disabled] [ref=e310]
          - button "k12, empty" [disabled] [ref=e311]
          - button "2W, l12, double word, empty" [disabled] [ref=e312]:
            - generic [ref=e313]: 2W
          - button "m12, empty" [disabled] [ref=e314]
          - button "2L, n12, double letter, empty" [disabled] [ref=e315]:
            - generic [ref=e316]: 2L
          - button "o12, empty" [disabled] [ref=e317]
          - generic [ref=e318]: "13"
          - button "a13, empty" [disabled] [ref=e319]
          - button "b13, empty" [disabled] [ref=e320]
          - button "c13, empty" [disabled] [ref=e321]
          - button "d13, empty" [disabled] [ref=e322]
          - button "3L, e13, triple letter, empty" [disabled] [ref=e323]:
            - generic [ref=e324]: 3L
          - button "f13, empty" [disabled] [ref=e325]
          - button "g13, empty" [disabled] [ref=e326]
          - button "h13, empty" [disabled] [ref=e327]
          - button "i13, empty" [disabled] [ref=e328]
          - button "j13, empty" [disabled] [ref=e329]
          - button "3L, k13, triple letter, empty" [disabled] [ref=e330]:
            - generic [ref=e331]: 3L
          - button "l13, empty" [disabled] [ref=e332]
          - button "m13, empty" [disabled] [ref=e333]
          - button "n13, empty" [disabled] [ref=e334]
          - button "o13, empty" [disabled] [ref=e335]
          - generic [ref=e336]: "14"
          - button "a14, empty" [disabled] [ref=e337]
          - button "b14, empty" [disabled] [ref=e338]
          - button "c14, empty" [disabled] [ref=e339]
          - button "2L, d14, double letter, empty" [disabled] [ref=e340]:
            - generic [ref=e341]: 2L
          - button "e14, empty" [disabled] [ref=e342]
          - button "f14, empty" [disabled] [ref=e343]
          - button "2W, g14, double word, empty" [disabled] [ref=e344]:
            - generic [ref=e345]: 2W
          - button "h14, empty" [disabled] [ref=e346]
          - button "2W, i14, double word, empty" [disabled] [ref=e347]:
            - generic [ref=e348]: 2W
          - button "j14, empty" [disabled] [ref=e349]
          - button "k14, empty" [disabled] [ref=e350]
          - button "2L, l14, double letter, empty" [disabled] [ref=e351]:
            - generic [ref=e352]: 2L
          - button "m14, empty" [disabled] [ref=e353]
          - button "n14, empty" [disabled] [ref=e354]
          - button "o14, empty" [disabled] [ref=e355]
          - generic [ref=e356]: "15"
          - button "2L, a15, double letter, empty" [disabled] [ref=e357]:
            - generic [ref=e358]: 2L
          - button "b15, empty" [disabled] [ref=e359]
          - button "c15, empty" [disabled] [ref=e360]
          - button "d15, empty" [disabled] [ref=e361]
          - button "3W, e15, triple word, empty" [disabled] [ref=e362]:
            - generic [ref=e363]: 3W
          - button "f15, empty" [disabled] [ref=e364]
          - button "g15, empty" [disabled] [ref=e365]
          - button "2L, h15, double letter, empty" [disabled] [ref=e366]:
            - generic [ref=e367]: 2L
          - button "i15, empty" [disabled] [ref=e368]
          - button "j15, empty" [disabled] [ref=e369]
          - button "3W, k15, triple word, empty" [disabled] [ref=e370]:
            - generic [ref=e371]: 3W
          - button "l15, empty" [disabled] [ref=e372]
          - button "m15, empty" [disabled] [ref=e373]
          - button "n15, empty" [disabled] [ref=e374]
          - button "2L, o15, double letter, empty" [disabled] [ref=e375]:
            - generic [ref=e376]: 2L
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