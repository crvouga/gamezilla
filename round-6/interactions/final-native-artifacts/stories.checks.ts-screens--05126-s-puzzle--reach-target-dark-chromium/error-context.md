# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-puzzle--reach-target dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  74313 pixels (ratio 0.23 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-puzzle/reach-target-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-puzzle/reach-target-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 74313 pixels (ratio 0.23 of all image pixels) are different.
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
  - 74313 pixels (ratio 0.23 of all image pixels) are different.

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
    - generic [ref=e26]:
      - generic [ref=e27]:
        - button "Fit board" [pressed] [ref=e28] [cursor=pointer]:
          - paragraph [ref=e31]: Fit board
        - button "Enlarge board" [ref=e32] [cursor=pointer]:
          - paragraph [ref=e35]: Enlarge board
      - region "Scrollable word board" [ref=e37]:
        - group "Puzzle board, fifteen columns and fifteen rows" [ref=e38]:
          - generic [ref=e40]: a
          - generic [ref=e41]: b
          - generic [ref=e42]: c
          - generic [ref=e43]: d
          - generic [ref=e44]: e
          - generic [ref=e45]: f
          - generic [ref=e46]: g
          - generic [ref=e47]: h
          - generic [ref=e48]: i
          - generic [ref=e49]: j
          - generic [ref=e50]: k
          - generic [ref=e51]: l
          - generic [ref=e52]: m
          - generic [ref=e53]: "n"
          - generic [ref=e54]: o
          - generic [ref=e55]: "1"
          - button "2L, a1, double letter, empty" [disabled] [ref=e56]:
            - generic [ref=e57]: 2L
          - button "b1, empty" [disabled] [ref=e58]
          - button "c1, empty" [disabled] [ref=e59]
          - button "d1, empty" [disabled] [ref=e60]
          - button "3W, e1, triple word, empty" [disabled] [ref=e61]:
            - generic [ref=e62]: 3W
          - button "f1, empty" [disabled] [ref=e63]
          - button "g1, empty" [disabled] [ref=e64]
          - button "2L, h1, double letter, empty" [disabled] [ref=e65]:
            - generic [ref=e66]: 2L
          - button "i1, empty" [disabled] [ref=e67]
          - button "j1, empty" [disabled] [ref=e68]
          - button "3W, k1, triple word, empty" [disabled] [ref=e69]:
            - generic [ref=e70]: 3W
          - button "l1, empty" [disabled] [ref=e71]
          - button "m1, empty" [disabled] [ref=e72]
          - button "n1, empty" [disabled] [ref=e73]
          - button "2L, o1, double letter, empty" [disabled] [ref=e74]:
            - generic [ref=e75]: 2L
          - generic [ref=e76]: "2"
          - button "a2, empty" [disabled] [ref=e77]
          - button "b2, empty" [disabled] [ref=e78]
          - button "c2, empty" [disabled] [ref=e79]
          - button "2L, d2, double letter, empty" [disabled] [ref=e80]:
            - generic [ref=e81]: 2L
          - button "e2, empty" [disabled] [ref=e82]
          - button "f2, empty" [disabled] [ref=e83]
          - button "2W, g2, double word, empty" [disabled] [ref=e84]:
            - generic [ref=e85]: 2W
          - button "h2, empty" [disabled] [ref=e86]
          - button "2W, i2, double word, empty" [disabled] [ref=e87]:
            - generic [ref=e88]: 2W
          - button "j2, empty" [disabled] [ref=e89]
          - button "k2, empty" [disabled] [ref=e90]
          - button "2L, l2, double letter, empty" [disabled] [ref=e91]:
            - generic [ref=e92]: 2L
          - button "m2, empty" [disabled] [ref=e93]
          - button "n2, empty" [disabled] [ref=e94]
          - button "o2, empty" [disabled] [ref=e95]
          - generic [ref=e96]: "3"
          - button "a3, empty" [disabled] [ref=e97]
          - button "b3, empty" [disabled] [ref=e98]
          - button "c3, empty" [disabled] [ref=e99]
          - button "d3, empty" [disabled] [ref=e100]
          - button "3L, e3, triple letter, empty" [disabled] [ref=e101]:
            - generic [ref=e102]: 3L
          - button "f3, empty" [disabled] [ref=e103]
          - button "g3, empty" [disabled] [ref=e104]
          - button "h3, empty" [disabled] [ref=e105]
          - button "i3, empty" [disabled] [ref=e106]
          - button "j3, empty" [disabled] [ref=e107]
          - button "3L, k3, triple letter, empty" [disabled] [ref=e108]:
            - generic [ref=e109]: 3L
          - button "l3, empty" [disabled] [ref=e110]
          - button "m3, empty" [disabled] [ref=e111]
          - button "n3, empty" [disabled] [ref=e112]
          - button "o3, empty" [disabled] [ref=e113]
          - generic [ref=e114]: "4"
          - button "a4, empty" [disabled] [ref=e115]
          - button "2L, b4, double letter, empty" [disabled] [ref=e116]:
            - generic [ref=e117]: 2L
          - button "c4, empty" [disabled] [ref=e118]
          - button "2W, d4, double word, empty" [disabled] [ref=e119]:
            - generic [ref=e120]: 2W
          - button "e4, empty" [disabled] [ref=e121]
          - button "f4, empty" [disabled] [ref=e122]
          - button "g4, empty" [disabled] [ref=e123]
          - button "h4, empty" [disabled] [ref=e124]
          - button "i4, empty" [disabled] [ref=e125]
          - button "j4, empty" [disabled] [ref=e126]
          - button "k4, empty" [disabled] [ref=e127]
          - button "2W, l4, double word, empty" [disabled] [ref=e128]:
            - generic [ref=e129]: 2W
          - button "m4, empty" [disabled] [ref=e130]
          - button "2L, n4, double letter, empty" [disabled] [ref=e131]:
            - generic [ref=e132]: 2L
          - button "o4, empty" [disabled] [ref=e133]
          - generic [ref=e134]: "5"
          - button "3W, a5, triple word, empty" [disabled] [ref=e135]:
            - generic [ref=e136]: 3W
          - button "b5, empty" [disabled] [ref=e137]
          - button "3L, c5, triple letter, empty" [disabled] [ref=e138]:
            - generic [ref=e139]: 3L
          - button "d5, empty" [disabled] [ref=e140]
          - button "e5, empty" [disabled] [ref=e141]
          - button "f5, empty" [disabled] [ref=e142]
          - button "2L, g5, double letter, empty" [disabled] [ref=e143]:
            - generic [ref=e144]: 2L
          - button "h5, empty" [disabled] [ref=e145]
          - button "2L, i5, double letter, empty" [disabled] [ref=e146]:
            - generic [ref=e147]: 2L
          - button "j5, empty" [disabled] [ref=e148]
          - button "k5, empty" [disabled] [ref=e149]
          - button "l5, empty" [disabled] [ref=e150]
          - button "3L, m5, triple letter, empty" [disabled] [ref=e151]:
            - generic [ref=e152]: 3L
          - button "n5, empty" [disabled] [ref=e153]
          - button "3W, o5, triple word, empty" [disabled] [ref=e154]:
            - generic [ref=e155]: 3W
          - generic [ref=e156]: "6"
          - button "a6, empty" [disabled] [ref=e157]
          - button "b6, empty" [disabled] [ref=e158]
          - button "c6, empty" [disabled] [ref=e159]
          - button "d6, empty" [disabled] [ref=e160]
          - button "e6, empty" [disabled] [ref=e161]
          - button "f6, empty" [disabled] [ref=e162]
          - button "g6, empty" [disabled] [ref=e163]
          - button "3L, h6, triple letter, empty" [disabled] [ref=e164]:
            - generic [ref=e165]: 3L
          - button "i6, empty" [disabled] [ref=e166]
          - button "j6, empty" [disabled] [ref=e167]
          - button "k6, empty" [disabled] [ref=e168]
          - button "l6, empty" [disabled] [ref=e169]
          - button "m6, empty" [disabled] [ref=e170]
          - button "n6, empty" [disabled] [ref=e171]
          - button "o6, empty" [disabled] [ref=e172]
          - generic [ref=e173]: "7"
          - button "a7, empty" [disabled] [ref=e174]
          - button "2W, b7, double word, empty" [disabled] [ref=e175]:
            - generic [ref=e176]: 2W
          - button "c7, empty" [disabled] [ref=e177]
          - button "d7, empty" [disabled] [ref=e178]
          - button "2L, e7, double letter, empty" [disabled] [ref=e179]:
            - generic [ref=e180]: 2L
          - button "f7, empty" [disabled] [ref=e181]
          - button "2L, g7, double letter, empty" [disabled] [ref=e182]:
            - generic [ref=e183]: 2L
          - button "h7, empty" [disabled] [ref=e184]
          - button "2L, i7, double letter, empty" [disabled] [ref=e185]:
            - generic [ref=e186]: 2L
          - button "j7, empty" [disabled] [ref=e187]
          - button "2L, k7, double letter, empty" [disabled] [ref=e188]:
            - generic [ref=e189]: 2L
          - button "l7, empty" [disabled] [ref=e190]
          - button "m7, empty" [disabled] [ref=e191]
          - button "2W, n7, double word, empty" [disabled] [ref=e192]:
            - generic [ref=e193]: 2W
          - button "o7, empty" [disabled] [ref=e194]
          - generic [ref=e195]: "8"
          - button "2L, a8, double letter, empty" [disabled] [ref=e196]:
            - generic [ref=e197]: 2L
          - button "b8, empty" [disabled] [ref=e198]
          - button "c8, empty" [disabled] [ref=e199]
          - button "d8, empty" [disabled] [ref=e200]
          - button "e8, empty" [disabled] [ref=e201]
          - button "3L, f8, triple letter, empty" [disabled] [ref=e202]:
            - generic [ref=e203]: 3L
          - button "C 3, g8, committed" [disabled] [ref=e204]:
            - generic [ref=e205]: C
          - button "A 1, h8, committed" [disabled] [ref=e206]:
            - generic [ref=e207]: A
          - button "T 1, i8, committed" [disabled] [ref=e208]:
            - generic [ref=e209]: T
          - button "S 1, j8, committed" [disabled] [ref=e210]:
            - generic [ref=e211]: S
          - button "k8, empty" [disabled] [ref=e212]
          - button "l8, empty" [disabled] [ref=e213]
          - button "m8, empty" [disabled] [ref=e214]
          - button "n8, empty" [disabled] [ref=e215]
          - button "2L, o8, double letter, empty" [disabled] [ref=e216]:
            - generic [ref=e217]: 2L
          - generic [ref=e218]: "9"
          - button "a9, empty" [disabled] [ref=e219]
          - button "2W, b9, double word, empty" [disabled] [ref=e220]:
            - generic [ref=e221]: 2W
          - button "c9, empty" [disabled] [ref=e222]
          - button "d9, empty" [disabled] [ref=e223]
          - button "2L, e9, double letter, empty" [disabled] [ref=e224]:
            - generic [ref=e225]: 2L
          - button "f9, empty" [disabled] [ref=e226]
          - button "2L, g9, double letter, empty" [disabled] [ref=e227]:
            - generic [ref=e228]: 2L
          - button "h9, empty" [disabled] [ref=e229]
          - button "O 1, i9, committed" [disabled] [ref=e230]:
            - generic [ref=e231]: O
          - button "j9, empty" [disabled] [ref=e232]
          - button "2L, k9, double letter, empty" [disabled] [ref=e233]:
            - generic [ref=e234]: 2L
          - button "l9, empty" [disabled] [ref=e235]
          - button "m9, empty" [disabled] [ref=e236]
          - button "2W, n9, double word, empty" [disabled] [ref=e237]:
            - generic [ref=e238]: 2W
          - button "o9, empty" [disabled] [ref=e239]
          - generic [ref=e240]: "10"
          - button "a10, empty" [disabled] [ref=e241]
          - button "b10, empty" [disabled] [ref=e242]
          - button "c10, empty" [disabled] [ref=e243]
          - button "d10, empty" [disabled] [ref=e244]
          - button "e10, empty" [disabled] [ref=e245]
          - button "f10, empty" [disabled] [ref=e246]
          - button "g10, empty" [disabled] [ref=e247]
          - button "3L, h10, triple letter, empty" [disabled] [ref=e248]:
            - generic [ref=e249]: 3L
          - button "E 1, i10, committed" [disabled] [ref=e250]:
            - generic [ref=e251]: E
          - button "j10, empty" [disabled] [ref=e252]
          - button "k10, empty" [disabled] [ref=e253]
          - button "l10, empty" [disabled] [ref=e254]
          - button "m10, empty" [disabled] [ref=e255]
          - button "n10, empty" [disabled] [ref=e256]
          - button "o10, empty" [disabled] [ref=e257]
          - generic [ref=e258]: "11"
          - button "3W, a11, triple word, empty" [disabled] [ref=e259]:
            - generic [ref=e260]: 3W
          - button "b11, empty" [disabled] [ref=e261]
          - button "3L, c11, triple letter, empty" [disabled] [ref=e262]:
            - generic [ref=e263]: 3L
          - button "d11, empty" [disabled] [ref=e264]
          - button "e11, empty" [disabled] [ref=e265]
          - button "f11, empty" [disabled] [ref=e266]
          - button "2L, g11, double letter, empty" [disabled] [ref=e267]:
            - generic [ref=e268]: 2L
          - button "h11, empty" [disabled] [ref=e269]
          - button "2L, i11, double letter, empty" [disabled] [ref=e270]:
            - generic [ref=e271]: 2L
          - button "j11, empty" [disabled] [ref=e272]
          - button "k11, empty" [disabled] [ref=e273]
          - button "l11, empty" [disabled] [ref=e274]
          - button "3L, m11, triple letter, empty" [disabled] [ref=e275]:
            - generic [ref=e276]: 3L
          - button "n11, empty" [disabled] [ref=e277]
          - button "3W, o11, triple word, empty" [disabled] [ref=e278]:
            - generic [ref=e279]: 3W
          - generic [ref=e280]: "12"
          - button "a12, empty" [disabled] [ref=e281]
          - button "2L, b12, double letter, empty" [disabled] [ref=e282]:
            - generic [ref=e283]: 2L
          - button "c12, empty" [disabled] [ref=e284]
          - button "2W, d12, double word, empty" [disabled] [ref=e285]:
            - generic [ref=e286]: 2W
          - button "e12, empty" [disabled] [ref=e287]
          - button "f12, empty" [disabled] [ref=e288]
          - button "g12, empty" [disabled] [ref=e289]
          - button "h12, empty" [disabled] [ref=e290]
          - button "i12, empty" [disabled] [ref=e291]
          - button "j12, empty" [disabled] [ref=e292]
          - button "k12, empty" [disabled] [ref=e293]
          - button "2W, l12, double word, empty" [disabled] [ref=e294]:
            - generic [ref=e295]: 2W
          - button "m12, empty" [disabled] [ref=e296]
          - button "2L, n12, double letter, empty" [disabled] [ref=e297]:
            - generic [ref=e298]: 2L
          - button "o12, empty" [disabled] [ref=e299]
          - generic [ref=e300]: "13"
          - button "a13, empty" [disabled] [ref=e301]
          - button "b13, empty" [disabled] [ref=e302]
          - button "c13, empty" [disabled] [ref=e303]
          - button "d13, empty" [disabled] [ref=e304]
          - button "3L, e13, triple letter, empty" [disabled] [ref=e305]:
            - generic [ref=e306]: 3L
          - button "f13, empty" [disabled] [ref=e307]
          - button "g13, empty" [disabled] [ref=e308]
          - button "h13, empty" [disabled] [ref=e309]
          - button "i13, empty" [disabled] [ref=e310]
          - button "j13, empty" [disabled] [ref=e311]
          - button "3L, k13, triple letter, empty" [disabled] [ref=e312]:
            - generic [ref=e313]: 3L
          - button "l13, empty" [disabled] [ref=e314]
          - button "m13, empty" [disabled] [ref=e315]
          - button "n13, empty" [disabled] [ref=e316]
          - button "o13, empty" [disabled] [ref=e317]
          - generic [ref=e318]: "14"
          - button "a14, empty" [disabled] [ref=e319]
          - button "b14, empty" [disabled] [ref=e320]
          - button "c14, empty" [disabled] [ref=e321]
          - button "2L, d14, double letter, empty" [disabled] [ref=e322]:
            - generic [ref=e323]: 2L
          - button "e14, empty" [disabled] [ref=e324]
          - button "f14, empty" [disabled] [ref=e325]
          - button "2W, g14, double word, empty" [disabled] [ref=e326]:
            - generic [ref=e327]: 2W
          - button "h14, empty" [disabled] [ref=e328]
          - button "2W, i14, double word, empty" [disabled] [ref=e329]:
            - generic [ref=e330]: 2W
          - button "j14, empty" [disabled] [ref=e331]
          - button "k14, empty" [disabled] [ref=e332]
          - button "2L, l14, double letter, empty" [disabled] [ref=e333]:
            - generic [ref=e334]: 2L
          - button "m14, empty" [disabled] [ref=e335]
          - button "n14, empty" [disabled] [ref=e336]
          - button "o14, empty" [disabled] [ref=e337]
          - generic [ref=e338]: "15"
          - button "2L, a15, double letter, empty" [disabled] [ref=e339]:
            - generic [ref=e340]: 2L
          - button "b15, empty" [disabled] [ref=e341]
          - button "c15, empty" [disabled] [ref=e342]
          - button "d15, empty" [disabled] [ref=e343]
          - button "3W, e15, triple word, empty" [disabled] [ref=e344]:
            - generic [ref=e345]: 3W
          - button "f15, empty" [disabled] [ref=e346]
          - button "g15, empty" [disabled] [ref=e347]
          - button "2L, h15, double letter, empty" [disabled] [ref=e348]:
            - generic [ref=e349]: 2L
          - button "i15, empty" [disabled] [ref=e350]
          - button "j15, empty" [disabled] [ref=e351]
          - button "3W, k15, triple word, empty" [disabled] [ref=e352]:
            - generic [ref=e353]: 3W
          - button "l15, empty" [disabled] [ref=e354]
          - button "m15, empty" [disabled] [ref=e355]
          - button "n15, empty" [disabled] [ref=e356]
          - button "2L, o15, double letter, empty" [disabled] [ref=e357]:
            - generic [ref=e358]: 2L
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