# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-puzzle--disabled light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  129697 pixels (ratio 0.11 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-puzzle/disabled-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-puzzle/disabled-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 129697 pixels (ratio 0.11 of all image pixels) are different.
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
  - 129697 pixels (ratio 0.11 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e13]:
    - paragraph [ref=e14]: Score at least 20 points in one move.
    - status [ref=e15]: This attempt is read-only. Placement is unavailable.
    - group "Your rack" [ref=e16]:
      - button "A, 1 points" [disabled] [ref=e17]:
        - generic [ref=e18]: A
        - generic [ref=e19]: "1"
      - button "E, 1 points" [disabled] [ref=e20]:
        - generic [ref=e21]: E
        - generic [ref=e22]: "1"
      - button "S, 1 points" [disabled] [ref=e23]:
        - generic [ref=e24]: S
        - generic [ref=e25]: "1"
      - button "T, 1 points" [disabled] [ref=e26]:
        - generic [ref=e27]: T
        - generic [ref=e28]: "1"
      - button "Blank, 0 points" [disabled] [ref=e29]:
        - generic [ref=e30]: "0"
      - button "R, 1 points" [disabled] [ref=e31]:
        - generic [ref=e32]: R
        - generic [ref=e33]: "1"
      - button "N, 1 points" [disabled] [ref=e34]:
        - generic [ref=e35]: "N"
        - generic [ref=e36]: "1"
    - generic [ref=e37]:
      - button "Play word" [disabled] [ref=e38]:
        - paragraph [ref=e41]: Play word
      - button "Recall tiles" [disabled] [ref=e42]:
        - paragraph [ref=e45]: Recall tiles
    - generic [ref=e46]:
      - generic [ref=e47]:
        - button "Fit board" [pressed] [ref=e48] [cursor=pointer]:
          - paragraph [ref=e51]: Fit board
        - button "Enlarge board" [ref=e52] [cursor=pointer]:
          - paragraph [ref=e55]: Enlarge board
      - region "Scrollable word board" [ref=e56]:
        - group "Puzzle board, fifteen columns and fifteen rows" [ref=e57]:
          - generic [ref=e59]: a
          - generic [ref=e60]: b
          - generic [ref=e61]: c
          - generic [ref=e62]: d
          - generic [ref=e63]: e
          - generic [ref=e64]: f
          - generic [ref=e65]: g
          - generic [ref=e66]: h
          - generic [ref=e67]: i
          - generic [ref=e68]: j
          - generic [ref=e69]: k
          - generic [ref=e70]: l
          - generic [ref=e71]: m
          - generic [ref=e72]: "n"
          - generic [ref=e73]: o
          - generic [ref=e74]: "1"
          - button "2L, a1, double letter, empty" [disabled] [ref=e75]:
            - generic [ref=e76]: 2L
          - button "b1, empty" [disabled] [ref=e77]
          - button "c1, empty" [disabled] [ref=e78]
          - button "d1, empty" [disabled] [ref=e79]
          - button "3W, e1, triple word, empty" [disabled] [ref=e80]:
            - generic [ref=e81]: 3W
          - button "f1, empty" [disabled] [ref=e82]
          - button "g1, empty" [disabled] [ref=e83]
          - button "2L, h1, double letter, empty" [disabled] [ref=e84]:
            - generic [ref=e85]: 2L
          - button "i1, empty" [disabled] [ref=e86]
          - button "j1, empty" [disabled] [ref=e87]
          - button "3W, k1, triple word, empty" [disabled] [ref=e88]:
            - generic [ref=e89]: 3W
          - button "l1, empty" [disabled] [ref=e90]
          - button "m1, empty" [disabled] [ref=e91]
          - button "n1, empty" [disabled] [ref=e92]
          - button "2L, o1, double letter, empty" [disabled] [ref=e93]:
            - generic [ref=e94]: 2L
          - generic [ref=e95]: "2"
          - button "a2, empty" [disabled] [ref=e96]
          - button "b2, empty" [disabled] [ref=e97]
          - button "c2, empty" [disabled] [ref=e98]
          - button "2L, d2, double letter, empty" [disabled] [ref=e99]:
            - generic [ref=e100]: 2L
          - button "e2, empty" [disabled] [ref=e101]
          - button "f2, empty" [disabled] [ref=e102]
          - button "2W, g2, double word, empty" [disabled] [ref=e103]:
            - generic [ref=e104]: 2W
          - button "h2, empty" [disabled] [ref=e105]
          - button "2W, i2, double word, empty" [disabled] [ref=e106]:
            - generic [ref=e107]: 2W
          - button "j2, empty" [disabled] [ref=e108]
          - button "k2, empty" [disabled] [ref=e109]
          - button "2L, l2, double letter, empty" [disabled] [ref=e110]:
            - generic [ref=e111]: 2L
          - button "m2, empty" [disabled] [ref=e112]
          - button "n2, empty" [disabled] [ref=e113]
          - button "o2, empty" [disabled] [ref=e114]
          - generic [ref=e115]: "3"
          - button "a3, empty" [disabled] [ref=e116]
          - button "b3, empty" [disabled] [ref=e117]
          - button "c3, empty" [disabled] [ref=e118]
          - button "d3, empty" [disabled] [ref=e119]
          - button "3L, e3, triple letter, empty" [disabled] [ref=e120]:
            - generic [ref=e121]: 3L
          - button "f3, empty" [disabled] [ref=e122]
          - button "g3, empty" [disabled] [ref=e123]
          - button "h3, empty" [disabled] [ref=e124]
          - button "i3, empty" [disabled] [ref=e125]
          - button "j3, empty" [disabled] [ref=e126]
          - button "3L, k3, triple letter, empty" [disabled] [ref=e127]:
            - generic [ref=e128]: 3L
          - button "l3, empty" [disabled] [ref=e129]
          - button "m3, empty" [disabled] [ref=e130]
          - button "n3, empty" [disabled] [ref=e131]
          - button "o3, empty" [disabled] [ref=e132]
          - generic [ref=e133]: "4"
          - button "a4, empty" [disabled] [ref=e134]
          - button "2L, b4, double letter, empty" [disabled] [ref=e135]:
            - generic [ref=e136]: 2L
          - button "c4, empty" [disabled] [ref=e137]
          - button "2W, d4, double word, empty" [disabled] [ref=e138]:
            - generic [ref=e139]: 2W
          - button "e4, empty" [disabled] [ref=e140]
          - button "f4, empty" [disabled] [ref=e141]
          - button "g4, empty" [disabled] [ref=e142]
          - button "h4, empty" [disabled] [ref=e143]
          - button "i4, empty" [disabled] [ref=e144]
          - button "j4, empty" [disabled] [ref=e145]
          - button "k4, empty" [disabled] [ref=e146]
          - button "2W, l4, double word, empty" [disabled] [ref=e147]:
            - generic [ref=e148]: 2W
          - button "m4, empty" [disabled] [ref=e149]
          - button "2L, n4, double letter, empty" [disabled] [ref=e150]:
            - generic [ref=e151]: 2L
          - button "o4, empty" [disabled] [ref=e152]
          - generic [ref=e153]: "5"
          - button "3W, a5, triple word, empty" [disabled] [ref=e154]:
            - generic [ref=e155]: 3W
          - button "b5, empty" [disabled] [ref=e156]
          - button "3L, c5, triple letter, empty" [disabled] [ref=e157]:
            - generic [ref=e158]: 3L
          - button "d5, empty" [disabled] [ref=e159]
          - button "e5, empty" [disabled] [ref=e160]
          - button "f5, empty" [disabled] [ref=e161]
          - button "2L, g5, double letter, empty" [disabled] [ref=e162]:
            - generic [ref=e163]: 2L
          - button "h5, empty" [disabled] [ref=e164]
          - button "2L, i5, double letter, empty" [disabled] [ref=e165]:
            - generic [ref=e166]: 2L
          - button "j5, empty" [disabled] [ref=e167]
          - button "k5, empty" [disabled] [ref=e168]
          - button "l5, empty" [disabled] [ref=e169]
          - button "3L, m5, triple letter, empty" [disabled] [ref=e170]:
            - generic [ref=e171]: 3L
          - button "n5, empty" [disabled] [ref=e172]
          - button "3W, o5, triple word, empty" [disabled] [ref=e173]:
            - generic [ref=e174]: 3W
          - generic [ref=e175]: "6"
          - button "a6, empty" [disabled] [ref=e176]
          - button "b6, empty" [disabled] [ref=e177]
          - button "c6, empty" [disabled] [ref=e178]
          - button "d6, empty" [disabled] [ref=e179]
          - button "e6, empty" [disabled] [ref=e180]
          - button "f6, empty" [disabled] [ref=e181]
          - button "g6, empty" [disabled] [ref=e182]
          - button "3L, h6, triple letter, empty" [disabled] [ref=e183]:
            - generic [ref=e184]: 3L
          - button "i6, empty" [disabled] [ref=e185]
          - button "j6, empty" [disabled] [ref=e186]
          - button "k6, empty" [disabled] [ref=e187]
          - button "l6, empty" [disabled] [ref=e188]
          - button "m6, empty" [disabled] [ref=e189]
          - button "n6, empty" [disabled] [ref=e190]
          - button "o6, empty" [disabled] [ref=e191]
          - generic [ref=e192]: "7"
          - button "a7, empty" [disabled] [ref=e193]
          - button "2W, b7, double word, empty" [disabled] [ref=e194]:
            - generic [ref=e195]: 2W
          - button "c7, empty" [disabled] [ref=e196]
          - button "d7, empty" [disabled] [ref=e197]
          - button "2L, e7, double letter, empty" [disabled] [ref=e198]:
            - generic [ref=e199]: 2L
          - button "f7, empty" [disabled] [ref=e200]
          - button "2L, g7, double letter, empty" [disabled] [ref=e201]:
            - generic [ref=e202]: 2L
          - button "h7, empty" [disabled] [ref=e203]
          - button "2L, i7, double letter, empty" [disabled] [ref=e204]:
            - generic [ref=e205]: 2L
          - button "j7, empty" [disabled] [ref=e206]
          - button "2L, k7, double letter, empty" [disabled] [ref=e207]:
            - generic [ref=e208]: 2L
          - button "l7, empty" [disabled] [ref=e209]
          - button "m7, empty" [disabled] [ref=e210]
          - button "2W, n7, double word, empty" [disabled] [ref=e211]:
            - generic [ref=e212]: 2W
          - button "o7, empty" [disabled] [ref=e213]
          - generic [ref=e214]: "8"
          - button "2L, a8, double letter, empty" [disabled] [ref=e215]:
            - generic [ref=e216]: 2L
          - button "b8, empty" [disabled] [ref=e217]
          - button "c8, empty" [disabled] [ref=e218]
          - button "d8, empty" [disabled] [ref=e219]
          - button "e8, empty" [disabled] [ref=e220]
          - button "3L, f8, triple letter, empty" [disabled] [ref=e221]:
            - generic [ref=e222]: 3L
          - button "C 3, g8, committed" [disabled] [ref=e223]:
            - generic [ref=e224]: C
            - generic [ref=e225]: "3"
          - button "A 1, h8, committed" [disabled] [ref=e226]:
            - generic [ref=e227]: A
            - generic [ref=e228]: "1"
          - button "T 1, i8, committed" [disabled] [ref=e229]:
            - generic [ref=e230]: T
            - generic [ref=e231]: "1"
          - button "3L, j8, triple letter, empty" [disabled] [ref=e232]:
            - generic [ref=e233]: 3L
          - button "k8, empty" [disabled] [ref=e234]
          - button "l8, empty" [disabled] [ref=e235]
          - button "m8, empty" [disabled] [ref=e236]
          - button "n8, empty" [disabled] [ref=e237]
          - button "2L, o8, double letter, empty" [disabled] [ref=e238]:
            - generic [ref=e239]: 2L
          - generic [ref=e240]: "9"
          - button "a9, empty" [disabled] [ref=e241]
          - button "2W, b9, double word, empty" [disabled] [ref=e242]:
            - generic [ref=e243]: 2W
          - button "c9, empty" [disabled] [ref=e244]
          - button "d9, empty" [disabled] [ref=e245]
          - button "2L, e9, double letter, empty" [disabled] [ref=e246]:
            - generic [ref=e247]: 2L
          - button "f9, empty" [disabled] [ref=e248]
          - button "2L, g9, double letter, empty" [disabled] [ref=e249]:
            - generic [ref=e250]: 2L
          - button "h9, empty" [disabled] [ref=e251]
          - button "O 1, i9, committed" [disabled] [ref=e252]:
            - generic [ref=e253]: O
            - generic [ref=e254]: "1"
          - button "j9, empty" [disabled] [ref=e255]
          - button "2L, k9, double letter, empty" [disabled] [ref=e256]:
            - generic [ref=e257]: 2L
          - button "l9, empty" [disabled] [ref=e258]
          - button "m9, empty" [disabled] [ref=e259]
          - button "2W, n9, double word, empty" [disabled] [ref=e260]:
            - generic [ref=e261]: 2W
          - button "o9, empty" [disabled] [ref=e262]
          - generic [ref=e263]: "10"
          - button "a10, empty" [disabled] [ref=e264]
          - button "b10, empty" [disabled] [ref=e265]
          - button "c10, empty" [disabled] [ref=e266]
          - button "d10, empty" [disabled] [ref=e267]
          - button "e10, empty" [disabled] [ref=e268]
          - button "f10, empty" [disabled] [ref=e269]
          - button "g10, empty" [disabled] [ref=e270]
          - button "3L, h10, triple letter, empty" [disabled] [ref=e271]:
            - generic [ref=e272]: 3L
          - button "E 1, i10, committed" [disabled] [ref=e273]:
            - generic [ref=e274]: E
            - generic [ref=e275]: "1"
          - button "j10, empty" [disabled] [ref=e276]
          - button "k10, empty" [disabled] [ref=e277]
          - button "l10, empty" [disabled] [ref=e278]
          - button "m10, empty" [disabled] [ref=e279]
          - button "n10, empty" [disabled] [ref=e280]
          - button "o10, empty" [disabled] [ref=e281]
          - generic [ref=e282]: "11"
          - button "3W, a11, triple word, empty" [disabled] [ref=e283]:
            - generic [ref=e284]: 3W
          - button "b11, empty" [disabled] [ref=e285]
          - button "3L, c11, triple letter, empty" [disabled] [ref=e286]:
            - generic [ref=e287]: 3L
          - button "d11, empty" [disabled] [ref=e288]
          - button "e11, empty" [disabled] [ref=e289]
          - button "f11, empty" [disabled] [ref=e290]
          - button "2L, g11, double letter, empty" [disabled] [ref=e291]:
            - generic [ref=e292]: 2L
          - button "h11, empty" [disabled] [ref=e293]
          - button "2L, i11, double letter, empty" [disabled] [ref=e294]:
            - generic [ref=e295]: 2L
          - button "j11, empty" [disabled] [ref=e296]
          - button "k11, empty" [disabled] [ref=e297]
          - button "l11, empty" [disabled] [ref=e298]
          - button "3L, m11, triple letter, empty" [disabled] [ref=e299]:
            - generic [ref=e300]: 3L
          - button "n11, empty" [disabled] [ref=e301]
          - button "3W, o11, triple word, empty" [disabled] [ref=e302]:
            - generic [ref=e303]: 3W
          - generic [ref=e304]: "12"
          - button "a12, empty" [disabled] [ref=e305]
          - button "2L, b12, double letter, empty" [disabled] [ref=e306]:
            - generic [ref=e307]: 2L
          - button "c12, empty" [disabled] [ref=e308]
          - button "2W, d12, double word, empty" [disabled] [ref=e309]:
            - generic [ref=e310]: 2W
          - button "e12, empty" [disabled] [ref=e311]
          - button "f12, empty" [disabled] [ref=e312]
          - button "g12, empty" [disabled] [ref=e313]
          - button "h12, empty" [disabled] [ref=e314]
          - button "i12, empty" [disabled] [ref=e315]
          - button "j12, empty" [disabled] [ref=e316]
          - button "k12, empty" [disabled] [ref=e317]
          - button "2W, l12, double word, empty" [disabled] [ref=e318]:
            - generic [ref=e319]: 2W
          - button "m12, empty" [disabled] [ref=e320]
          - button "2L, n12, double letter, empty" [disabled] [ref=e321]:
            - generic [ref=e322]: 2L
          - button "o12, empty" [disabled] [ref=e323]
          - generic [ref=e324]: "13"
          - button "a13, empty" [disabled] [ref=e325]
          - button "b13, empty" [disabled] [ref=e326]
          - button "c13, empty" [disabled] [ref=e327]
          - button "d13, empty" [disabled] [ref=e328]
          - button "3L, e13, triple letter, empty" [disabled] [ref=e329]:
            - generic [ref=e330]: 3L
          - button "f13, empty" [disabled] [ref=e331]
          - button "g13, empty" [disabled] [ref=e332]
          - button "h13, empty" [disabled] [ref=e333]
          - button "i13, empty" [disabled] [ref=e334]
          - button "j13, empty" [disabled] [ref=e335]
          - button "3L, k13, triple letter, empty" [disabled] [ref=e336]:
            - generic [ref=e337]: 3L
          - button "l13, empty" [disabled] [ref=e338]
          - button "m13, empty" [disabled] [ref=e339]
          - button "n13, empty" [disabled] [ref=e340]
          - button "o13, empty" [disabled] [ref=e341]
          - generic [ref=e342]: "14"
          - button "a14, empty" [disabled] [ref=e343]
          - button "b14, empty" [disabled] [ref=e344]
          - button "c14, empty" [disabled] [ref=e345]
          - button "2L, d14, double letter, empty" [disabled] [ref=e346]:
            - generic [ref=e347]: 2L
          - button "e14, empty" [disabled] [ref=e348]
          - button "f14, empty" [disabled] [ref=e349]
          - button "2W, g14, double word, empty" [disabled] [ref=e350]:
            - generic [ref=e351]: 2W
          - button "h14, empty" [disabled] [ref=e352]
          - button "2W, i14, double word, empty" [disabled] [ref=e353]:
            - generic [ref=e354]: 2W
          - button "j14, empty" [disabled] [ref=e355]
          - button "k14, empty" [disabled] [ref=e356]
          - button "2L, l14, double letter, empty" [disabled] [ref=e357]:
            - generic [ref=e358]: 2L
          - button "m14, empty" [disabled] [ref=e359]
          - button "n14, empty" [disabled] [ref=e360]
          - button "o14, empty" [disabled] [ref=e361]
          - generic [ref=e362]: "15"
          - button "2L, a15, double letter, empty" [disabled] [ref=e363]:
            - generic [ref=e364]: 2L
          - button "b15, empty" [disabled] [ref=e365]
          - button "c15, empty" [disabled] [ref=e366]
          - button "d15, empty" [disabled] [ref=e367]
          - button "3W, e15, triple word, empty" [disabled] [ref=e368]:
            - generic [ref=e369]: 3W
          - button "f15, empty" [disabled] [ref=e370]
          - button "g15, empty" [disabled] [ref=e371]
          - button "2L, h15, double letter, empty" [disabled] [ref=e372]:
            - generic [ref=e373]: 2L
          - button "i15, empty" [disabled] [ref=e374]
          - button "j15, empty" [disabled] [ref=e375]
          - button "3W, k15, triple word, empty" [disabled] [ref=e376]:
            - generic [ref=e377]: 3W
          - button "l15, empty" [disabled] [ref=e378]
          - button "m15, empty" [disabled] [ref=e379]
          - button "n15, empty" [disabled] [ref=e380]
          - button "2L, o15, double letter, empty" [disabled] [ref=e381]:
            - generic [ref=e382]: 2L
    - paragraph [ref=e383]: "Bonus squares: 2L doubles a letter, 3L triples a letter, 2W doubles the word, 3W triples the word."
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