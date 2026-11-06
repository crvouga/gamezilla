# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-puzzle--reach-target light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  217748 pixels (ratio 0.18 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-puzzle/reach-target-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-puzzle/reach-target-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 217748 pixels (ratio 0.18 of all image pixels) are different.
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
  - 217748 pixels (ratio 0.18 of all image pixels) are different.

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
    - generic [ref=e28]:
      - generic [ref=e29]:
        - button "Fit board" [pressed] [ref=e30] [cursor=pointer]:
          - paragraph [ref=e33]: Fit board
        - button "Enlarge board" [ref=e34] [cursor=pointer]:
          - paragraph [ref=e37]: Enlarge board
      - region "Scrollable word board" [ref=e39]:
        - group "Puzzle board, fifteen columns and fifteen rows" [ref=e40]:
          - generic [ref=e42]: a
          - generic [ref=e43]: b
          - generic [ref=e44]: c
          - generic [ref=e45]: d
          - generic [ref=e46]: e
          - generic [ref=e47]: f
          - generic [ref=e48]: g
          - generic [ref=e49]: h
          - generic [ref=e50]: i
          - generic [ref=e51]: j
          - generic [ref=e52]: k
          - generic [ref=e53]: l
          - generic [ref=e54]: m
          - generic [ref=e55]: "n"
          - generic [ref=e56]: o
          - generic [ref=e57]: "1"
          - button "2L, a1, double letter, empty" [disabled] [ref=e58]:
            - generic [ref=e59]: 2L
          - button "b1, empty" [disabled] [ref=e60]
          - button "c1, empty" [disabled] [ref=e61]
          - button "d1, empty" [disabled] [ref=e62]
          - button "3W, e1, triple word, empty" [disabled] [ref=e63]:
            - generic [ref=e64]: 3W
          - button "f1, empty" [disabled] [ref=e65]
          - button "g1, empty" [disabled] [ref=e66]
          - button "2L, h1, double letter, empty" [disabled] [ref=e67]:
            - generic [ref=e68]: 2L
          - button "i1, empty" [disabled] [ref=e69]
          - button "j1, empty" [disabled] [ref=e70]
          - button "3W, k1, triple word, empty" [disabled] [ref=e71]:
            - generic [ref=e72]: 3W
          - button "l1, empty" [disabled] [ref=e73]
          - button "m1, empty" [disabled] [ref=e74]
          - button "n1, empty" [disabled] [ref=e75]
          - button "2L, o1, double letter, empty" [disabled] [ref=e76]:
            - generic [ref=e77]: 2L
          - generic [ref=e78]: "2"
          - button "a2, empty" [disabled] [ref=e79]
          - button "b2, empty" [disabled] [ref=e80]
          - button "c2, empty" [disabled] [ref=e81]
          - button "2L, d2, double letter, empty" [disabled] [ref=e82]:
            - generic [ref=e83]: 2L
          - button "e2, empty" [disabled] [ref=e84]
          - button "f2, empty" [disabled] [ref=e85]
          - button "2W, g2, double word, empty" [disabled] [ref=e86]:
            - generic [ref=e87]: 2W
          - button "h2, empty" [disabled] [ref=e88]
          - button "2W, i2, double word, empty" [disabled] [ref=e89]:
            - generic [ref=e90]: 2W
          - button "j2, empty" [disabled] [ref=e91]
          - button "k2, empty" [disabled] [ref=e92]
          - button "2L, l2, double letter, empty" [disabled] [ref=e93]:
            - generic [ref=e94]: 2L
          - button "m2, empty" [disabled] [ref=e95]
          - button "n2, empty" [disabled] [ref=e96]
          - button "o2, empty" [disabled] [ref=e97]
          - generic [ref=e98]: "3"
          - button "a3, empty" [disabled] [ref=e99]
          - button "b3, empty" [disabled] [ref=e100]
          - button "c3, empty" [disabled] [ref=e101]
          - button "d3, empty" [disabled] [ref=e102]
          - button "3L, e3, triple letter, empty" [disabled] [ref=e103]:
            - generic [ref=e104]: 3L
          - button "f3, empty" [disabled] [ref=e105]
          - button "g3, empty" [disabled] [ref=e106]
          - button "h3, empty" [disabled] [ref=e107]
          - button "i3, empty" [disabled] [ref=e108]
          - button "j3, empty" [disabled] [ref=e109]
          - button "3L, k3, triple letter, empty" [disabled] [ref=e110]:
            - generic [ref=e111]: 3L
          - button "l3, empty" [disabled] [ref=e112]
          - button "m3, empty" [disabled] [ref=e113]
          - button "n3, empty" [disabled] [ref=e114]
          - button "o3, empty" [disabled] [ref=e115]
          - generic [ref=e116]: "4"
          - button "a4, empty" [disabled] [ref=e117]
          - button "2L, b4, double letter, empty" [disabled] [ref=e118]:
            - generic [ref=e119]: 2L
          - button "c4, empty" [disabled] [ref=e120]
          - button "2W, d4, double word, empty" [disabled] [ref=e121]:
            - generic [ref=e122]: 2W
          - button "e4, empty" [disabled] [ref=e123]
          - button "f4, empty" [disabled] [ref=e124]
          - button "g4, empty" [disabled] [ref=e125]
          - button "h4, empty" [disabled] [ref=e126]
          - button "i4, empty" [disabled] [ref=e127]
          - button "j4, empty" [disabled] [ref=e128]
          - button "k4, empty" [disabled] [ref=e129]
          - button "2W, l4, double word, empty" [disabled] [ref=e130]:
            - generic [ref=e131]: 2W
          - button "m4, empty" [disabled] [ref=e132]
          - button "2L, n4, double letter, empty" [disabled] [ref=e133]:
            - generic [ref=e134]: 2L
          - button "o4, empty" [disabled] [ref=e135]
          - generic [ref=e136]: "5"
          - button "3W, a5, triple word, empty" [disabled] [ref=e137]:
            - generic [ref=e138]: 3W
          - button "b5, empty" [disabled] [ref=e139]
          - button "3L, c5, triple letter, empty" [disabled] [ref=e140]:
            - generic [ref=e141]: 3L
          - button "d5, empty" [disabled] [ref=e142]
          - button "e5, empty" [disabled] [ref=e143]
          - button "f5, empty" [disabled] [ref=e144]
          - button "2L, g5, double letter, empty" [disabled] [ref=e145]:
            - generic [ref=e146]: 2L
          - button "h5, empty" [disabled] [ref=e147]
          - button "2L, i5, double letter, empty" [disabled] [ref=e148]:
            - generic [ref=e149]: 2L
          - button "j5, empty" [disabled] [ref=e150]
          - button "k5, empty" [disabled] [ref=e151]
          - button "l5, empty" [disabled] [ref=e152]
          - button "3L, m5, triple letter, empty" [disabled] [ref=e153]:
            - generic [ref=e154]: 3L
          - button "n5, empty" [disabled] [ref=e155]
          - button "3W, o5, triple word, empty" [disabled] [ref=e156]:
            - generic [ref=e157]: 3W
          - generic [ref=e158]: "6"
          - button "a6, empty" [disabled] [ref=e159]
          - button "b6, empty" [disabled] [ref=e160]
          - button "c6, empty" [disabled] [ref=e161]
          - button "d6, empty" [disabled] [ref=e162]
          - button "e6, empty" [disabled] [ref=e163]
          - button "f6, empty" [disabled] [ref=e164]
          - button "g6, empty" [disabled] [ref=e165]
          - button "3L, h6, triple letter, empty" [disabled] [ref=e166]:
            - generic [ref=e167]: 3L
          - button "i6, empty" [disabled] [ref=e168]
          - button "j6, empty" [disabled] [ref=e169]
          - button "k6, empty" [disabled] [ref=e170]
          - button "l6, empty" [disabled] [ref=e171]
          - button "m6, empty" [disabled] [ref=e172]
          - button "n6, empty" [disabled] [ref=e173]
          - button "o6, empty" [disabled] [ref=e174]
          - generic [ref=e175]: "7"
          - button "a7, empty" [disabled] [ref=e176]
          - button "2W, b7, double word, empty" [disabled] [ref=e177]:
            - generic [ref=e178]: 2W
          - button "c7, empty" [disabled] [ref=e179]
          - button "d7, empty" [disabled] [ref=e180]
          - button "2L, e7, double letter, empty" [disabled] [ref=e181]:
            - generic [ref=e182]: 2L
          - button "f7, empty" [disabled] [ref=e183]
          - button "2L, g7, double letter, empty" [disabled] [ref=e184]:
            - generic [ref=e185]: 2L
          - button "h7, empty" [disabled] [ref=e186]
          - button "2L, i7, double letter, empty" [disabled] [ref=e187]:
            - generic [ref=e188]: 2L
          - button "j7, empty" [disabled] [ref=e189]
          - button "2L, k7, double letter, empty" [disabled] [ref=e190]:
            - generic [ref=e191]: 2L
          - button "l7, empty" [disabled] [ref=e192]
          - button "m7, empty" [disabled] [ref=e193]
          - button "2W, n7, double word, empty" [disabled] [ref=e194]:
            - generic [ref=e195]: 2W
          - button "o7, empty" [disabled] [ref=e196]
          - generic [ref=e197]: "8"
          - button "2L, a8, double letter, empty" [disabled] [ref=e198]:
            - generic [ref=e199]: 2L
          - button "b8, empty" [disabled] [ref=e200]
          - button "c8, empty" [disabled] [ref=e201]
          - button "d8, empty" [disabled] [ref=e202]
          - button "e8, empty" [disabled] [ref=e203]
          - button "3L, f8, triple letter, empty" [disabled] [ref=e204]:
            - generic [ref=e205]: 3L
          - button "C 3, g8, committed" [disabled] [ref=e206]:
            - generic [ref=e207]: C
            - generic [ref=e208]: "3"
          - button "A 1, h8, committed" [disabled] [ref=e209]:
            - generic [ref=e210]: A
            - generic [ref=e211]: "1"
          - button "T 1, i8, committed" [disabled] [ref=e212]:
            - generic [ref=e213]: T
            - generic [ref=e214]: "1"
          - button "S 1, j8, committed" [disabled] [ref=e215]:
            - generic [ref=e216]: S
            - generic [ref=e217]: "1"
          - button "k8, empty" [disabled] [ref=e218]
          - button "l8, empty" [disabled] [ref=e219]
          - button "m8, empty" [disabled] [ref=e220]
          - button "n8, empty" [disabled] [ref=e221]
          - button "2L, o8, double letter, empty" [disabled] [ref=e222]:
            - generic [ref=e223]: 2L
          - generic [ref=e224]: "9"
          - button "a9, empty" [disabled] [ref=e225]
          - button "2W, b9, double word, empty" [disabled] [ref=e226]:
            - generic [ref=e227]: 2W
          - button "c9, empty" [disabled] [ref=e228]
          - button "d9, empty" [disabled] [ref=e229]
          - button "2L, e9, double letter, empty" [disabled] [ref=e230]:
            - generic [ref=e231]: 2L
          - button "f9, empty" [disabled] [ref=e232]
          - button "2L, g9, double letter, empty" [disabled] [ref=e233]:
            - generic [ref=e234]: 2L
          - button "h9, empty" [disabled] [ref=e235]
          - button "O 1, i9, committed" [disabled] [ref=e236]:
            - generic [ref=e237]: O
            - generic [ref=e238]: "1"
          - button "j9, empty" [disabled] [ref=e239]
          - button "2L, k9, double letter, empty" [disabled] [ref=e240]:
            - generic [ref=e241]: 2L
          - button "l9, empty" [disabled] [ref=e242]
          - button "m9, empty" [disabled] [ref=e243]
          - button "2W, n9, double word, empty" [disabled] [ref=e244]:
            - generic [ref=e245]: 2W
          - button "o9, empty" [disabled] [ref=e246]
          - generic [ref=e247]: "10"
          - button "a10, empty" [disabled] [ref=e248]
          - button "b10, empty" [disabled] [ref=e249]
          - button "c10, empty" [disabled] [ref=e250]
          - button "d10, empty" [disabled] [ref=e251]
          - button "e10, empty" [disabled] [ref=e252]
          - button "f10, empty" [disabled] [ref=e253]
          - button "g10, empty" [disabled] [ref=e254]
          - button "3L, h10, triple letter, empty" [disabled] [ref=e255]:
            - generic [ref=e256]: 3L
          - button "E 1, i10, committed" [disabled] [ref=e257]:
            - generic [ref=e258]: E
            - generic [ref=e259]: "1"
          - button "j10, empty" [disabled] [ref=e260]
          - button "k10, empty" [disabled] [ref=e261]
          - button "l10, empty" [disabled] [ref=e262]
          - button "m10, empty" [disabled] [ref=e263]
          - button "n10, empty" [disabled] [ref=e264]
          - button "o10, empty" [disabled] [ref=e265]
          - generic [ref=e266]: "11"
          - button "3W, a11, triple word, empty" [disabled] [ref=e267]:
            - generic [ref=e268]: 3W
          - button "b11, empty" [disabled] [ref=e269]
          - button "3L, c11, triple letter, empty" [disabled] [ref=e270]:
            - generic [ref=e271]: 3L
          - button "d11, empty" [disabled] [ref=e272]
          - button "e11, empty" [disabled] [ref=e273]
          - button "f11, empty" [disabled] [ref=e274]
          - button "2L, g11, double letter, empty" [disabled] [ref=e275]:
            - generic [ref=e276]: 2L
          - button "h11, empty" [disabled] [ref=e277]
          - button "2L, i11, double letter, empty" [disabled] [ref=e278]:
            - generic [ref=e279]: 2L
          - button "j11, empty" [disabled] [ref=e280]
          - button "k11, empty" [disabled] [ref=e281]
          - button "l11, empty" [disabled] [ref=e282]
          - button "3L, m11, triple letter, empty" [disabled] [ref=e283]:
            - generic [ref=e284]: 3L
          - button "n11, empty" [disabled] [ref=e285]
          - button "3W, o11, triple word, empty" [disabled] [ref=e286]:
            - generic [ref=e287]: 3W
          - generic [ref=e288]: "12"
          - button "a12, empty" [disabled] [ref=e289]
          - button "2L, b12, double letter, empty" [disabled] [ref=e290]:
            - generic [ref=e291]: 2L
          - button "c12, empty" [disabled] [ref=e292]
          - button "2W, d12, double word, empty" [disabled] [ref=e293]:
            - generic [ref=e294]: 2W
          - button "e12, empty" [disabled] [ref=e295]
          - button "f12, empty" [disabled] [ref=e296]
          - button "g12, empty" [disabled] [ref=e297]
          - button "h12, empty" [disabled] [ref=e298]
          - button "i12, empty" [disabled] [ref=e299]
          - button "j12, empty" [disabled] [ref=e300]
          - button "k12, empty" [disabled] [ref=e301]
          - button "2W, l12, double word, empty" [disabled] [ref=e302]:
            - generic [ref=e303]: 2W
          - button "m12, empty" [disabled] [ref=e304]
          - button "2L, n12, double letter, empty" [disabled] [ref=e305]:
            - generic [ref=e306]: 2L
          - button "o12, empty" [disabled] [ref=e307]
          - generic [ref=e308]: "13"
          - button "a13, empty" [disabled] [ref=e309]
          - button "b13, empty" [disabled] [ref=e310]
          - button "c13, empty" [disabled] [ref=e311]
          - button "d13, empty" [disabled] [ref=e312]
          - button "3L, e13, triple letter, empty" [disabled] [ref=e313]:
            - generic [ref=e314]: 3L
          - button "f13, empty" [disabled] [ref=e315]
          - button "g13, empty" [disabled] [ref=e316]
          - button "h13, empty" [disabled] [ref=e317]
          - button "i13, empty" [disabled] [ref=e318]
          - button "j13, empty" [disabled] [ref=e319]
          - button "3L, k13, triple letter, empty" [disabled] [ref=e320]:
            - generic [ref=e321]: 3L
          - button "l13, empty" [disabled] [ref=e322]
          - button "m13, empty" [disabled] [ref=e323]
          - button "n13, empty" [disabled] [ref=e324]
          - button "o13, empty" [disabled] [ref=e325]
          - generic [ref=e326]: "14"
          - button "a14, empty" [disabled] [ref=e327]
          - button "b14, empty" [disabled] [ref=e328]
          - button "c14, empty" [disabled] [ref=e329]
          - button "2L, d14, double letter, empty" [disabled] [ref=e330]:
            - generic [ref=e331]: 2L
          - button "e14, empty" [disabled] [ref=e332]
          - button "f14, empty" [disabled] [ref=e333]
          - button "2W, g14, double word, empty" [disabled] [ref=e334]:
            - generic [ref=e335]: 2W
          - button "h14, empty" [disabled] [ref=e336]
          - button "2W, i14, double word, empty" [disabled] [ref=e337]:
            - generic [ref=e338]: 2W
          - button "j14, empty" [disabled] [ref=e339]
          - button "k14, empty" [disabled] [ref=e340]
          - button "2L, l14, double letter, empty" [disabled] [ref=e341]:
            - generic [ref=e342]: 2L
          - button "m14, empty" [disabled] [ref=e343]
          - button "n14, empty" [disabled] [ref=e344]
          - button "o14, empty" [disabled] [ref=e345]
          - generic [ref=e346]: "15"
          - button "2L, a15, double letter, empty" [disabled] [ref=e347]:
            - generic [ref=e348]: 2L
          - button "b15, empty" [disabled] [ref=e349]
          - button "c15, empty" [disabled] [ref=e350]
          - button "d15, empty" [disabled] [ref=e351]
          - button "3W, e15, triple word, empty" [disabled] [ref=e352]:
            - generic [ref=e353]: 3W
          - button "f15, empty" [disabled] [ref=e354]
          - button "g15, empty" [disabled] [ref=e355]
          - button "2L, h15, double letter, empty" [disabled] [ref=e356]:
            - generic [ref=e357]: 2L
          - button "i15, empty" [disabled] [ref=e358]
          - button "j15, empty" [disabled] [ref=e359]
          - button "3W, k15, triple word, empty" [disabled] [ref=e360]:
            - generic [ref=e361]: 3W
          - button "l15, empty" [disabled] [ref=e362]
          - button "m15, empty" [disabled] [ref=e363]
          - button "n15, empty" [disabled] [ref=e364]
          - button "2L, o15, double letter, empty" [disabled] [ref=e365]:
            - generic [ref=e366]: 2L
    - paragraph [ref=e367]: "Bonus squares: 2L doubles a letter, 3L triples a letter, 2W doubles the word, 3W triples the word."
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