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
  73400 pixels (ratio 0.23 of all image pixels) are different.

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
  - 73400 pixels (ratio 0.23 of all image pixels) are different.
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
  - 73400 pixels (ratio 0.23 of all image pixels) are different.

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
    - generic [ref=e25]:
      - generic [ref=e26]:
        - button "Fit board" [pressed] [ref=e27] [cursor=pointer]:
          - paragraph [ref=e30]: Fit board
        - button "Enlarge board" [ref=e31] [cursor=pointer]:
          - paragraph [ref=e34]: Enlarge board
      - region "Scrollable word board" [ref=e36]:
        - group "Puzzle board, fifteen columns and fifteen rows" [ref=e37]:
          - generic [ref=e39]: a
          - generic [ref=e40]: b
          - generic [ref=e41]: c
          - generic [ref=e42]: d
          - generic [ref=e43]: e
          - generic [ref=e44]: f
          - generic [ref=e45]: g
          - generic [ref=e46]: h
          - generic [ref=e47]: i
          - generic [ref=e48]: j
          - generic [ref=e49]: k
          - generic [ref=e50]: l
          - generic [ref=e51]: m
          - generic [ref=e52]: "n"
          - generic [ref=e53]: o
          - generic [ref=e54]: "1"
          - button "2L, a1, double letter, empty" [disabled] [ref=e55]:
            - generic [ref=e56]: 2L
          - button "b1, empty" [disabled] [ref=e57]
          - button "c1, empty" [disabled] [ref=e58]
          - button "d1, empty" [disabled] [ref=e59]
          - button "3W, e1, triple word, empty" [disabled] [ref=e60]:
            - generic [ref=e61]: 3W
          - button "f1, empty" [disabled] [ref=e62]
          - button "g1, empty" [disabled] [ref=e63]
          - button "2L, h1, double letter, empty" [disabled] [ref=e64]:
            - generic [ref=e65]: 2L
          - button "i1, empty" [disabled] [ref=e66]
          - button "j1, empty" [disabled] [ref=e67]
          - button "3W, k1, triple word, empty" [disabled] [ref=e68]:
            - generic [ref=e69]: 3W
          - button "l1, empty" [disabled] [ref=e70]
          - button "m1, empty" [disabled] [ref=e71]
          - button "n1, empty" [disabled] [ref=e72]
          - button "2L, o1, double letter, empty" [disabled] [ref=e73]:
            - generic [ref=e74]: 2L
          - generic [ref=e75]: "2"
          - button "a2, empty" [disabled] [ref=e76]
          - button "b2, empty" [disabled] [ref=e77]
          - button "c2, empty" [disabled] [ref=e78]
          - button "2L, d2, double letter, empty" [disabled] [ref=e79]:
            - generic [ref=e80]: 2L
          - button "e2, empty" [disabled] [ref=e81]
          - button "f2, empty" [disabled] [ref=e82]
          - button "2W, g2, double word, empty" [disabled] [ref=e83]:
            - generic [ref=e84]: 2W
          - button "h2, empty" [disabled] [ref=e85]
          - button "2W, i2, double word, empty" [disabled] [ref=e86]:
            - generic [ref=e87]: 2W
          - button "j2, empty" [disabled] [ref=e88]
          - button "k2, empty" [disabled] [ref=e89]
          - button "2L, l2, double letter, empty" [disabled] [ref=e90]:
            - generic [ref=e91]: 2L
          - button "m2, empty" [disabled] [ref=e92]
          - button "n2, empty" [disabled] [ref=e93]
          - button "o2, empty" [disabled] [ref=e94]
          - generic [ref=e95]: "3"
          - button "a3, empty" [disabled] [ref=e96]
          - button "b3, empty" [disabled] [ref=e97]
          - button "c3, empty" [disabled] [ref=e98]
          - button "d3, empty" [disabled] [ref=e99]
          - button "3L, e3, triple letter, empty" [disabled] [ref=e100]:
            - generic [ref=e101]: 3L
          - button "f3, empty" [disabled] [ref=e102]
          - button "g3, empty" [disabled] [ref=e103]
          - button "h3, empty" [disabled] [ref=e104]
          - button "i3, empty" [disabled] [ref=e105]
          - button "j3, empty" [disabled] [ref=e106]
          - button "3L, k3, triple letter, empty" [disabled] [ref=e107]:
            - generic [ref=e108]: 3L
          - button "l3, empty" [disabled] [ref=e109]
          - button "m3, empty" [disabled] [ref=e110]
          - button "n3, empty" [disabled] [ref=e111]
          - button "o3, empty" [disabled] [ref=e112]
          - generic [ref=e113]: "4"
          - button "a4, empty" [disabled] [ref=e114]
          - button "2L, b4, double letter, empty" [disabled] [ref=e115]:
            - generic [ref=e116]: 2L
          - button "c4, empty" [disabled] [ref=e117]
          - button "2W, d4, double word, empty" [disabled] [ref=e118]:
            - generic [ref=e119]: 2W
          - button "e4, empty" [disabled] [ref=e120]
          - button "f4, empty" [disabled] [ref=e121]
          - button "g4, empty" [disabled] [ref=e122]
          - button "h4, empty" [disabled] [ref=e123]
          - button "i4, empty" [disabled] [ref=e124]
          - button "j4, empty" [disabled] [ref=e125]
          - button "k4, empty" [disabled] [ref=e126]
          - button "2W, l4, double word, empty" [disabled] [ref=e127]:
            - generic [ref=e128]: 2W
          - button "m4, empty" [disabled] [ref=e129]
          - button "2L, n4, double letter, empty" [disabled] [ref=e130]:
            - generic [ref=e131]: 2L
          - button "o4, empty" [disabled] [ref=e132]
          - generic [ref=e133]: "5"
          - button "3W, a5, triple word, empty" [disabled] [ref=e134]:
            - generic [ref=e135]: 3W
          - button "b5, empty" [disabled] [ref=e136]
          - button "3L, c5, triple letter, empty" [disabled] [ref=e137]:
            - generic [ref=e138]: 3L
          - button "d5, empty" [disabled] [ref=e139]
          - button "e5, empty" [disabled] [ref=e140]
          - button "f5, empty" [disabled] [ref=e141]
          - button "2L, g5, double letter, empty" [disabled] [ref=e142]:
            - generic [ref=e143]: 2L
          - button "h5, empty" [disabled] [ref=e144]
          - button "2L, i5, double letter, empty" [disabled] [ref=e145]:
            - generic [ref=e146]: 2L
          - button "j5, empty" [disabled] [ref=e147]
          - button "k5, empty" [disabled] [ref=e148]
          - button "l5, empty" [disabled] [ref=e149]
          - button "3L, m5, triple letter, empty" [disabled] [ref=e150]:
            - generic [ref=e151]: 3L
          - button "n5, empty" [disabled] [ref=e152]
          - button "3W, o5, triple word, empty" [disabled] [ref=e153]:
            - generic [ref=e154]: 3W
          - generic [ref=e155]: "6"
          - button "a6, empty" [disabled] [ref=e156]
          - button "b6, empty" [disabled] [ref=e157]
          - button "c6, empty" [disabled] [ref=e158]
          - button "d6, empty" [disabled] [ref=e159]
          - button "e6, empty" [disabled] [ref=e160]
          - button "f6, empty" [disabled] [ref=e161]
          - button "g6, empty" [disabled] [ref=e162]
          - button "3L, h6, triple letter, empty" [disabled] [ref=e163]:
            - generic [ref=e164]: 3L
          - button "i6, empty" [disabled] [ref=e165]
          - button "j6, empty" [disabled] [ref=e166]
          - button "k6, empty" [disabled] [ref=e167]
          - button "l6, empty" [disabled] [ref=e168]
          - button "m6, empty" [disabled] [ref=e169]
          - button "n6, empty" [disabled] [ref=e170]
          - button "o6, empty" [disabled] [ref=e171]
          - generic [ref=e172]: "7"
          - button "a7, empty" [disabled] [ref=e173]
          - button "2W, b7, double word, empty" [disabled] [ref=e174]:
            - generic [ref=e175]: 2W
          - button "c7, empty" [disabled] [ref=e176]
          - button "d7, empty" [disabled] [ref=e177]
          - button "2L, e7, double letter, empty" [disabled] [ref=e178]:
            - generic [ref=e179]: 2L
          - button "f7, empty" [disabled] [ref=e180]
          - button "2L, g7, double letter, empty" [disabled] [ref=e181]:
            - generic [ref=e182]: 2L
          - button "h7, empty" [disabled] [ref=e183]
          - button "2L, i7, double letter, empty" [disabled] [ref=e184]:
            - generic [ref=e185]: 2L
          - button "j7, empty" [disabled] [ref=e186]
          - button "2L, k7, double letter, empty" [disabled] [ref=e187]:
            - generic [ref=e188]: 2L
          - button "l7, empty" [disabled] [ref=e189]
          - button "m7, empty" [disabled] [ref=e190]
          - button "2W, n7, double word, empty" [disabled] [ref=e191]:
            - generic [ref=e192]: 2W
          - button "o7, empty" [disabled] [ref=e193]
          - generic [ref=e194]: "8"
          - button "2L, a8, double letter, empty" [disabled] [ref=e195]:
            - generic [ref=e196]: 2L
          - button "b8, empty" [disabled] [ref=e197]
          - button "c8, empty" [disabled] [ref=e198]
          - button "d8, empty" [disabled] [ref=e199]
          - button "e8, empty" [disabled] [ref=e200]
          - button "3L, f8, triple letter, empty" [disabled] [ref=e201]:
            - generic [ref=e202]: 3L
          - button "C 3, g8, committed" [disabled] [ref=e203]:
            - generic [ref=e204]: C
          - button "A 1, h8, committed" [disabled] [ref=e205]:
            - generic [ref=e206]: A
          - button "T 1, i8, committed" [disabled] [ref=e207]:
            - generic [ref=e208]: T
          - button "S 1, j8, committed" [disabled] [ref=e209]:
            - generic [ref=e210]: S
          - button "k8, empty" [disabled] [ref=e211]
          - button "l8, empty" [disabled] [ref=e212]
          - button "m8, empty" [disabled] [ref=e213]
          - button "n8, empty" [disabled] [ref=e214]
          - button "2L, o8, double letter, empty" [disabled] [ref=e215]:
            - generic [ref=e216]: 2L
          - generic [ref=e217]: "9"
          - button "a9, empty" [disabled] [ref=e218]
          - button "2W, b9, double word, empty" [disabled] [ref=e219]:
            - generic [ref=e220]: 2W
          - button "c9, empty" [disabled] [ref=e221]
          - button "d9, empty" [disabled] [ref=e222]
          - button "2L, e9, double letter, empty" [disabled] [ref=e223]:
            - generic [ref=e224]: 2L
          - button "f9, empty" [disabled] [ref=e225]
          - button "2L, g9, double letter, empty" [disabled] [ref=e226]:
            - generic [ref=e227]: 2L
          - button "h9, empty" [disabled] [ref=e228]
          - button "O 1, i9, committed" [disabled] [ref=e229]:
            - generic [ref=e230]: O
          - button "j9, empty" [disabled] [ref=e231]
          - button "2L, k9, double letter, empty" [disabled] [ref=e232]:
            - generic [ref=e233]: 2L
          - button "l9, empty" [disabled] [ref=e234]
          - button "m9, empty" [disabled] [ref=e235]
          - button "2W, n9, double word, empty" [disabled] [ref=e236]:
            - generic [ref=e237]: 2W
          - button "o9, empty" [disabled] [ref=e238]
          - generic [ref=e239]: "10"
          - button "a10, empty" [disabled] [ref=e240]
          - button "b10, empty" [disabled] [ref=e241]
          - button "c10, empty" [disabled] [ref=e242]
          - button "d10, empty" [disabled] [ref=e243]
          - button "e10, empty" [disabled] [ref=e244]
          - button "f10, empty" [disabled] [ref=e245]
          - button "g10, empty" [disabled] [ref=e246]
          - button "3L, h10, triple letter, empty" [disabled] [ref=e247]:
            - generic [ref=e248]: 3L
          - button "E 1, i10, committed" [disabled] [ref=e249]:
            - generic [ref=e250]: E
          - button "j10, empty" [disabled] [ref=e251]
          - button "k10, empty" [disabled] [ref=e252]
          - button "l10, empty" [disabled] [ref=e253]
          - button "m10, empty" [disabled] [ref=e254]
          - button "n10, empty" [disabled] [ref=e255]
          - button "o10, empty" [disabled] [ref=e256]
          - generic [ref=e257]: "11"
          - button "3W, a11, triple word, empty" [disabled] [ref=e258]:
            - generic [ref=e259]: 3W
          - button "b11, empty" [disabled] [ref=e260]
          - button "3L, c11, triple letter, empty" [disabled] [ref=e261]:
            - generic [ref=e262]: 3L
          - button "d11, empty" [disabled] [ref=e263]
          - button "e11, empty" [disabled] [ref=e264]
          - button "f11, empty" [disabled] [ref=e265]
          - button "2L, g11, double letter, empty" [disabled] [ref=e266]:
            - generic [ref=e267]: 2L
          - button "h11, empty" [disabled] [ref=e268]
          - button "2L, i11, double letter, empty" [disabled] [ref=e269]:
            - generic [ref=e270]: 2L
          - button "j11, empty" [disabled] [ref=e271]
          - button "k11, empty" [disabled] [ref=e272]
          - button "l11, empty" [disabled] [ref=e273]
          - button "3L, m11, triple letter, empty" [disabled] [ref=e274]:
            - generic [ref=e275]: 3L
          - button "n11, empty" [disabled] [ref=e276]
          - button "3W, o11, triple word, empty" [disabled] [ref=e277]:
            - generic [ref=e278]: 3W
          - generic [ref=e279]: "12"
          - button "a12, empty" [disabled] [ref=e280]
          - button "2L, b12, double letter, empty" [disabled] [ref=e281]:
            - generic [ref=e282]: 2L
          - button "c12, empty" [disabled] [ref=e283]
          - button "2W, d12, double word, empty" [disabled] [ref=e284]:
            - generic [ref=e285]: 2W
          - button "e12, empty" [disabled] [ref=e286]
          - button "f12, empty" [disabled] [ref=e287]
          - button "g12, empty" [disabled] [ref=e288]
          - button "h12, empty" [disabled] [ref=e289]
          - button "i12, empty" [disabled] [ref=e290]
          - button "j12, empty" [disabled] [ref=e291]
          - button "k12, empty" [disabled] [ref=e292]
          - button "2W, l12, double word, empty" [disabled] [ref=e293]:
            - generic [ref=e294]: 2W
          - button "m12, empty" [disabled] [ref=e295]
          - button "2L, n12, double letter, empty" [disabled] [ref=e296]:
            - generic [ref=e297]: 2L
          - button "o12, empty" [disabled] [ref=e298]
          - generic [ref=e299]: "13"
          - button "a13, empty" [disabled] [ref=e300]
          - button "b13, empty" [disabled] [ref=e301]
          - button "c13, empty" [disabled] [ref=e302]
          - button "d13, empty" [disabled] [ref=e303]
          - button "3L, e13, triple letter, empty" [disabled] [ref=e304]:
            - generic [ref=e305]: 3L
          - button "f13, empty" [disabled] [ref=e306]
          - button "g13, empty" [disabled] [ref=e307]
          - button "h13, empty" [disabled] [ref=e308]
          - button "i13, empty" [disabled] [ref=e309]
          - button "j13, empty" [disabled] [ref=e310]
          - button "3L, k13, triple letter, empty" [disabled] [ref=e311]:
            - generic [ref=e312]: 3L
          - button "l13, empty" [disabled] [ref=e313]
          - button "m13, empty" [disabled] [ref=e314]
          - button "n13, empty" [disabled] [ref=e315]
          - button "o13, empty" [disabled] [ref=e316]
          - generic [ref=e317]: "14"
          - button "a14, empty" [disabled] [ref=e318]
          - button "b14, empty" [disabled] [ref=e319]
          - button "c14, empty" [disabled] [ref=e320]
          - button "2L, d14, double letter, empty" [disabled] [ref=e321]:
            - generic [ref=e322]: 2L
          - button "e14, empty" [disabled] [ref=e323]
          - button "f14, empty" [disabled] [ref=e324]
          - button "2W, g14, double word, empty" [disabled] [ref=e325]:
            - generic [ref=e326]: 2W
          - button "h14, empty" [disabled] [ref=e327]
          - button "2W, i14, double word, empty" [disabled] [ref=e328]:
            - generic [ref=e329]: 2W
          - button "j14, empty" [disabled] [ref=e330]
          - button "k14, empty" [disabled] [ref=e331]
          - button "2L, l14, double letter, empty" [disabled] [ref=e332]:
            - generic [ref=e333]: 2L
          - button "m14, empty" [disabled] [ref=e334]
          - button "n14, empty" [disabled] [ref=e335]
          - button "o14, empty" [disabled] [ref=e336]
          - generic [ref=e337]: "15"
          - button "2L, a15, double letter, empty" [disabled] [ref=e338]:
            - generic [ref=e339]: 2L
          - button "b15, empty" [disabled] [ref=e340]
          - button "c15, empty" [disabled] [ref=e341]
          - button "d15, empty" [disabled] [ref=e342]
          - button "3W, e15, triple word, empty" [disabled] [ref=e343]:
            - generic [ref=e344]: 3W
          - button "f15, empty" [disabled] [ref=e345]
          - button "g15, empty" [disabled] [ref=e346]
          - button "2L, h15, double letter, empty" [disabled] [ref=e347]:
            - generic [ref=e348]: 2L
          - button "i15, empty" [disabled] [ref=e349]
          - button "j15, empty" [disabled] [ref=e350]
          - button "3W, k15, triple word, empty" [disabled] [ref=e351]:
            - generic [ref=e352]: 3W
          - button "l15, empty" [disabled] [ref=e353]
          - button "m15, empty" [disabled] [ref=e354]
          - button "n15, empty" [disabled] [ref=e355]
          - button "2L, o15, double letter, empty" [disabled] [ref=e356]:
            - generic [ref=e357]: 2L
    - paragraph [ref=e358]: "Bonus squares: 2L doubles a letter, 3L triples a letter, 2W doubles the word, 3W triples the word."
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