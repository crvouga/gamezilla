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
  163636 pixels (ratio 0.14 of all image pixels) are different.

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
  - 163636 pixels (ratio 0.14 of all image pixels) are different.
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
  - 163636 pixels (ratio 0.14 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e13]:
    - paragraph [ref=e14]: Score at least 6 points in one move.
    - status [ref=e15]: Your last move scored 8 of 6.
    - generic [ref=e16]:
      - img [ref=e19]
      - generic [ref=e22]:
        - status [ref=e23]: Target reached. Puzzle solved!
        - button "Puzzle library" [active] [ref=e24] [cursor=pointer]:
          - paragraph [ref=e27]: Puzzle library
    - paragraph [ref=e28]: "2L/3L: double/triple letter. 2W/3W: double/triple word."
    - generic [ref=e29]:
      - generic [ref=e30]:
        - button "Fit board" [pressed] [ref=e31] [cursor=pointer]:
          - paragraph [ref=e34]: Fit board
        - button "Enlarge board" [ref=e35] [cursor=pointer]:
          - paragraph [ref=e38]: Enlarge board
      - region "Scrollable word board" [ref=e40]:
        - group "Puzzle board, fifteen columns and fifteen rows" [ref=e41]:
          - generic [ref=e43]: a
          - generic [ref=e44]: b
          - generic [ref=e45]: c
          - generic [ref=e46]: d
          - generic [ref=e47]: e
          - generic [ref=e48]: f
          - generic [ref=e49]: g
          - generic [ref=e50]: h
          - generic [ref=e51]: i
          - generic [ref=e52]: j
          - generic [ref=e53]: k
          - generic [ref=e54]: l
          - generic [ref=e55]: m
          - generic [ref=e56]: "n"
          - generic [ref=e57]: o
          - generic [ref=e58]: "1"
          - button "2L, a1, double letter, empty" [disabled] [ref=e59]:
            - generic [ref=e60]: 2L
          - button "b1, empty" [disabled] [ref=e61]
          - button "c1, empty" [disabled] [ref=e62]
          - button "d1, empty" [disabled] [ref=e63]
          - button "3W, e1, triple word, empty" [disabled] [ref=e64]:
            - generic [ref=e65]: 3W
          - button "f1, empty" [disabled] [ref=e66]
          - button "g1, empty" [disabled] [ref=e67]
          - button "2L, h1, double letter, empty" [disabled] [ref=e68]:
            - generic [ref=e69]: 2L
          - button "i1, empty" [disabled] [ref=e70]
          - button "j1, empty" [disabled] [ref=e71]
          - button "3W, k1, triple word, empty" [disabled] [ref=e72]:
            - generic [ref=e73]: 3W
          - button "l1, empty" [disabled] [ref=e74]
          - button "m1, empty" [disabled] [ref=e75]
          - button "n1, empty" [disabled] [ref=e76]
          - button "2L, o1, double letter, empty" [disabled] [ref=e77]:
            - generic [ref=e78]: 2L
          - generic [ref=e79]: "2"
          - button "a2, empty" [disabled] [ref=e80]
          - button "b2, empty" [disabled] [ref=e81]
          - button "c2, empty" [disabled] [ref=e82]
          - button "2L, d2, double letter, empty" [disabled] [ref=e83]:
            - generic [ref=e84]: 2L
          - button "e2, empty" [disabled] [ref=e85]
          - button "f2, empty" [disabled] [ref=e86]
          - button "2W, g2, double word, empty" [disabled] [ref=e87]:
            - generic [ref=e88]: 2W
          - button "h2, empty" [disabled] [ref=e89]
          - button "2W, i2, double word, empty" [disabled] [ref=e90]:
            - generic [ref=e91]: 2W
          - button "j2, empty" [disabled] [ref=e92]
          - button "k2, empty" [disabled] [ref=e93]
          - button "2L, l2, double letter, empty" [disabled] [ref=e94]:
            - generic [ref=e95]: 2L
          - button "m2, empty" [disabled] [ref=e96]
          - button "n2, empty" [disabled] [ref=e97]
          - button "o2, empty" [disabled] [ref=e98]
          - generic [ref=e99]: "3"
          - button "a3, empty" [disabled] [ref=e100]
          - button "b3, empty" [disabled] [ref=e101]
          - button "c3, empty" [disabled] [ref=e102]
          - button "d3, empty" [disabled] [ref=e103]
          - button "3L, e3, triple letter, empty" [disabled] [ref=e104]:
            - generic [ref=e105]: 3L
          - button "f3, empty" [disabled] [ref=e106]
          - button "g3, empty" [disabled] [ref=e107]
          - button "h3, empty" [disabled] [ref=e108]
          - button "i3, empty" [disabled] [ref=e109]
          - button "j3, empty" [disabled] [ref=e110]
          - button "3L, k3, triple letter, empty" [disabled] [ref=e111]:
            - generic [ref=e112]: 3L
          - button "l3, empty" [disabled] [ref=e113]
          - button "m3, empty" [disabled] [ref=e114]
          - button "n3, empty" [disabled] [ref=e115]
          - button "o3, empty" [disabled] [ref=e116]
          - generic [ref=e117]: "4"
          - button "a4, empty" [disabled] [ref=e118]
          - button "2L, b4, double letter, empty" [disabled] [ref=e119]:
            - generic [ref=e120]: 2L
          - button "c4, empty" [disabled] [ref=e121]
          - button "2W, d4, double word, empty" [disabled] [ref=e122]:
            - generic [ref=e123]: 2W
          - button "e4, empty" [disabled] [ref=e124]
          - button "f4, empty" [disabled] [ref=e125]
          - button "g4, empty" [disabled] [ref=e126]
          - button "h4, empty" [disabled] [ref=e127]
          - button "i4, empty" [disabled] [ref=e128]
          - button "j4, empty" [disabled] [ref=e129]
          - button "k4, empty" [disabled] [ref=e130]
          - button "2W, l4, double word, empty" [disabled] [ref=e131]:
            - generic [ref=e132]: 2W
          - button "m4, empty" [disabled] [ref=e133]
          - button "2L, n4, double letter, empty" [disabled] [ref=e134]:
            - generic [ref=e135]: 2L
          - button "o4, empty" [disabled] [ref=e136]
          - generic [ref=e137]: "5"
          - button "3W, a5, triple word, empty" [disabled] [ref=e138]:
            - generic [ref=e139]: 3W
          - button "b5, empty" [disabled] [ref=e140]
          - button "3L, c5, triple letter, empty" [disabled] [ref=e141]:
            - generic [ref=e142]: 3L
          - button "d5, empty" [disabled] [ref=e143]
          - button "e5, empty" [disabled] [ref=e144]
          - button "f5, empty" [disabled] [ref=e145]
          - button "2L, g5, double letter, empty" [disabled] [ref=e146]:
            - generic [ref=e147]: 2L
          - button "h5, empty" [disabled] [ref=e148]
          - button "2L, i5, double letter, empty" [disabled] [ref=e149]:
            - generic [ref=e150]: 2L
          - button "j5, empty" [disabled] [ref=e151]
          - button "k5, empty" [disabled] [ref=e152]
          - button "l5, empty" [disabled] [ref=e153]
          - button "3L, m5, triple letter, empty" [disabled] [ref=e154]:
            - generic [ref=e155]: 3L
          - button "n5, empty" [disabled] [ref=e156]
          - button "3W, o5, triple word, empty" [disabled] [ref=e157]:
            - generic [ref=e158]: 3W
          - generic [ref=e159]: "6"
          - button "a6, empty" [disabled] [ref=e160]
          - button "b6, empty" [disabled] [ref=e161]
          - button "c6, empty" [disabled] [ref=e162]
          - button "d6, empty" [disabled] [ref=e163]
          - button "e6, empty" [disabled] [ref=e164]
          - button "f6, empty" [disabled] [ref=e165]
          - button "g6, empty" [disabled] [ref=e166]
          - button "3L, h6, triple letter, empty" [disabled] [ref=e167]:
            - generic [ref=e168]: 3L
          - button "i6, empty" [disabled] [ref=e169]
          - button "j6, empty" [disabled] [ref=e170]
          - button "k6, empty" [disabled] [ref=e171]
          - button "l6, empty" [disabled] [ref=e172]
          - button "m6, empty" [disabled] [ref=e173]
          - button "n6, empty" [disabled] [ref=e174]
          - button "o6, empty" [disabled] [ref=e175]
          - generic [ref=e176]: "7"
          - button "a7, empty" [disabled] [ref=e177]
          - button "2W, b7, double word, empty" [disabled] [ref=e178]:
            - generic [ref=e179]: 2W
          - button "c7, empty" [disabled] [ref=e180]
          - button "d7, empty" [disabled] [ref=e181]
          - button "2L, e7, double letter, empty" [disabled] [ref=e182]:
            - generic [ref=e183]: 2L
          - button "f7, empty" [disabled] [ref=e184]
          - button "2L, g7, double letter, empty" [disabled] [ref=e185]:
            - generic [ref=e186]: 2L
          - button "h7, empty" [disabled] [ref=e187]
          - button "2L, i7, double letter, empty" [disabled] [ref=e188]:
            - generic [ref=e189]: 2L
          - button "j7, empty" [disabled] [ref=e190]
          - button "2L, k7, double letter, empty" [disabled] [ref=e191]:
            - generic [ref=e192]: 2L
          - button "l7, empty" [disabled] [ref=e193]
          - button "m7, empty" [disabled] [ref=e194]
          - button "2W, n7, double word, empty" [disabled] [ref=e195]:
            - generic [ref=e196]: 2W
          - button "o7, empty" [disabled] [ref=e197]
          - generic [ref=e198]: "8"
          - button "2L, a8, double letter, empty" [disabled] [ref=e199]:
            - generic [ref=e200]: 2L
          - button "b8, empty" [disabled] [ref=e201]
          - button "c8, empty" [disabled] [ref=e202]
          - button "d8, empty" [disabled] [ref=e203]
          - button "e8, empty" [disabled] [ref=e204]
          - button "3L, f8, triple letter, empty" [disabled] [ref=e205]:
            - generic [ref=e206]: 3L
          - button "C 3, g8, committed" [disabled] [ref=e207]:
            - generic [ref=e208]: C
            - generic [ref=e209]: "3"
          - button "A 1, h8, committed" [disabled] [ref=e210]:
            - generic [ref=e211]: A
            - generic [ref=e212]: "1"
          - button "T 1, i8, committed" [disabled] [ref=e213]:
            - generic [ref=e214]: T
            - generic [ref=e215]: "1"
          - button "S 1, j8, committed" [disabled] [ref=e216]:
            - generic [ref=e217]: S
            - generic [ref=e218]: "1"
          - button "k8, empty" [disabled] [ref=e219]
          - button "l8, empty" [disabled] [ref=e220]
          - button "m8, empty" [disabled] [ref=e221]
          - button "n8, empty" [disabled] [ref=e222]
          - button "2L, o8, double letter, empty" [disabled] [ref=e223]:
            - generic [ref=e224]: 2L
          - generic [ref=e225]: "9"
          - button "a9, empty" [disabled] [ref=e226]
          - button "2W, b9, double word, empty" [disabled] [ref=e227]:
            - generic [ref=e228]: 2W
          - button "c9, empty" [disabled] [ref=e229]
          - button "d9, empty" [disabled] [ref=e230]
          - button "2L, e9, double letter, empty" [disabled] [ref=e231]:
            - generic [ref=e232]: 2L
          - button "f9, empty" [disabled] [ref=e233]
          - button "2L, g9, double letter, empty" [disabled] [ref=e234]:
            - generic [ref=e235]: 2L
          - button "h9, empty" [disabled] [ref=e236]
          - button "O 1, i9, committed" [disabled] [ref=e237]:
            - generic [ref=e238]: O
            - generic [ref=e239]: "1"
          - button "j9, empty" [disabled] [ref=e240]
          - button "2L, k9, double letter, empty" [disabled] [ref=e241]:
            - generic [ref=e242]: 2L
          - button "l9, empty" [disabled] [ref=e243]
          - button "m9, empty" [disabled] [ref=e244]
          - button "2W, n9, double word, empty" [disabled] [ref=e245]:
            - generic [ref=e246]: 2W
          - button "o9, empty" [disabled] [ref=e247]
          - generic [ref=e248]: "10"
          - button "a10, empty" [disabled] [ref=e249]
          - button "b10, empty" [disabled] [ref=e250]
          - button "c10, empty" [disabled] [ref=e251]
          - button "d10, empty" [disabled] [ref=e252]
          - button "e10, empty" [disabled] [ref=e253]
          - button "f10, empty" [disabled] [ref=e254]
          - button "g10, empty" [disabled] [ref=e255]
          - button "3L, h10, triple letter, empty" [disabled] [ref=e256]:
            - generic [ref=e257]: 3L
          - button "E 1, i10, committed" [disabled] [ref=e258]:
            - generic [ref=e259]: E
            - generic [ref=e260]: "1"
          - button "j10, empty" [disabled] [ref=e261]
          - button "k10, empty" [disabled] [ref=e262]
          - button "l10, empty" [disabled] [ref=e263]
          - button "m10, empty" [disabled] [ref=e264]
          - button "n10, empty" [disabled] [ref=e265]
          - button "o10, empty" [disabled] [ref=e266]
          - generic [ref=e267]: "11"
          - button "3W, a11, triple word, empty" [disabled] [ref=e268]:
            - generic [ref=e269]: 3W
          - button "b11, empty" [disabled] [ref=e270]
          - button "3L, c11, triple letter, empty" [disabled] [ref=e271]:
            - generic [ref=e272]: 3L
          - button "d11, empty" [disabled] [ref=e273]
          - button "e11, empty" [disabled] [ref=e274]
          - button "f11, empty" [disabled] [ref=e275]
          - button "2L, g11, double letter, empty" [disabled] [ref=e276]:
            - generic [ref=e277]: 2L
          - button "h11, empty" [disabled] [ref=e278]
          - button "2L, i11, double letter, empty" [disabled] [ref=e279]:
            - generic [ref=e280]: 2L
          - button "j11, empty" [disabled] [ref=e281]
          - button "k11, empty" [disabled] [ref=e282]
          - button "l11, empty" [disabled] [ref=e283]
          - button "3L, m11, triple letter, empty" [disabled] [ref=e284]:
            - generic [ref=e285]: 3L
          - button "n11, empty" [disabled] [ref=e286]
          - button "3W, o11, triple word, empty" [disabled] [ref=e287]:
            - generic [ref=e288]: 3W
          - generic [ref=e289]: "12"
          - button "a12, empty" [disabled] [ref=e290]
          - button "2L, b12, double letter, empty" [disabled] [ref=e291]:
            - generic [ref=e292]: 2L
          - button "c12, empty" [disabled] [ref=e293]
          - button "2W, d12, double word, empty" [disabled] [ref=e294]:
            - generic [ref=e295]: 2W
          - button "e12, empty" [disabled] [ref=e296]
          - button "f12, empty" [disabled] [ref=e297]
          - button "g12, empty" [disabled] [ref=e298]
          - button "h12, empty" [disabled] [ref=e299]
          - button "i12, empty" [disabled] [ref=e300]
          - button "j12, empty" [disabled] [ref=e301]
          - button "k12, empty" [disabled] [ref=e302]
          - button "2W, l12, double word, empty" [disabled] [ref=e303]:
            - generic [ref=e304]: 2W
          - button "m12, empty" [disabled] [ref=e305]
          - button "2L, n12, double letter, empty" [disabled] [ref=e306]:
            - generic [ref=e307]: 2L
          - button "o12, empty" [disabled] [ref=e308]
          - generic [ref=e309]: "13"
          - button "a13, empty" [disabled] [ref=e310]
          - button "b13, empty" [disabled] [ref=e311]
          - button "c13, empty" [disabled] [ref=e312]
          - button "d13, empty" [disabled] [ref=e313]
          - button "3L, e13, triple letter, empty" [disabled] [ref=e314]:
            - generic [ref=e315]: 3L
          - button "f13, empty" [disabled] [ref=e316]
          - button "g13, empty" [disabled] [ref=e317]
          - button "h13, empty" [disabled] [ref=e318]
          - button "i13, empty" [disabled] [ref=e319]
          - button "j13, empty" [disabled] [ref=e320]
          - button "3L, k13, triple letter, empty" [disabled] [ref=e321]:
            - generic [ref=e322]: 3L
          - button "l13, empty" [disabled] [ref=e323]
          - button "m13, empty" [disabled] [ref=e324]
          - button "n13, empty" [disabled] [ref=e325]
          - button "o13, empty" [disabled] [ref=e326]
          - generic [ref=e327]: "14"
          - button "a14, empty" [disabled] [ref=e328]
          - button "b14, empty" [disabled] [ref=e329]
          - button "c14, empty" [disabled] [ref=e330]
          - button "2L, d14, double letter, empty" [disabled] [ref=e331]:
            - generic [ref=e332]: 2L
          - button "e14, empty" [disabled] [ref=e333]
          - button "f14, empty" [disabled] [ref=e334]
          - button "2W, g14, double word, empty" [disabled] [ref=e335]:
            - generic [ref=e336]: 2W
          - button "h14, empty" [disabled] [ref=e337]
          - button "2W, i14, double word, empty" [disabled] [ref=e338]:
            - generic [ref=e339]: 2W
          - button "j14, empty" [disabled] [ref=e340]
          - button "k14, empty" [disabled] [ref=e341]
          - button "2L, l14, double letter, empty" [disabled] [ref=e342]:
            - generic [ref=e343]: 2L
          - button "m14, empty" [disabled] [ref=e344]
          - button "n14, empty" [disabled] [ref=e345]
          - button "o14, empty" [disabled] [ref=e346]
          - generic [ref=e347]: "15"
          - button "2L, a15, double letter, empty" [disabled] [ref=e348]:
            - generic [ref=e349]: 2L
          - button "b15, empty" [disabled] [ref=e350]
          - button "c15, empty" [disabled] [ref=e351]
          - button "d15, empty" [disabled] [ref=e352]
          - button "3W, e15, triple word, empty" [disabled] [ref=e353]:
            - generic [ref=e354]: 3W
          - button "f15, empty" [disabled] [ref=e355]
          - button "g15, empty" [disabled] [ref=e356]
          - button "2L, h15, double letter, empty" [disabled] [ref=e357]:
            - generic [ref=e358]: 2L
          - button "i15, empty" [disabled] [ref=e359]
          - button "j15, empty" [disabled] [ref=e360]
          - button "3W, k15, triple word, empty" [disabled] [ref=e361]:
            - generic [ref=e362]: 3W
          - button "l15, empty" [disabled] [ref=e363]
          - button "m15, empty" [disabled] [ref=e364]
          - button "n15, empty" [disabled] [ref=e365]
          - button "2L, o15, double letter, empty" [disabled] [ref=e366]:
            - generic [ref=e367]: 2L
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