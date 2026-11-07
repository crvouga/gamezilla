# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-puzzle--disabled dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  67384 pixels (ratio 0.21 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-puzzle/disabled-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-puzzle/disabled-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 67384 pixels (ratio 0.21 of all image pixels) are different.
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
  - 67384 pixels (ratio 0.21 of all image pixels) are different.

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
    - generic [ref=e45]:
      - region "Scrollable word board" [ref=e46]:
        - group "Puzzle board, fifteen columns and fifteen rows" [ref=e47]:
          - generic [ref=e49]: a
          - generic [ref=e50]: b
          - generic [ref=e51]: c
          - generic [ref=e52]: d
          - generic [ref=e53]: e
          - generic [ref=e54]: f
          - generic [ref=e55]: g
          - generic [ref=e56]: h
          - generic [ref=e57]: i
          - generic [ref=e58]: j
          - generic [ref=e59]: k
          - generic [ref=e60]: l
          - generic [ref=e61]: m
          - generic [ref=e62]: "n"
          - generic [ref=e63]: o
          - generic [ref=e64]: "1"
          - button "2L, a1, double letter, empty" [disabled] [ref=e65]:
            - generic [ref=e66]: 2L
          - button "b1, empty" [disabled] [ref=e67]
          - button "c1, empty" [disabled] [ref=e68]
          - button "d1, empty" [disabled] [ref=e69]
          - button "3W, e1, triple word, empty" [disabled] [ref=e70]:
            - generic [ref=e71]: 3W
          - button "f1, empty" [disabled] [ref=e72]
          - button "g1, empty" [disabled] [ref=e73]
          - button "2L, h1, double letter, empty" [disabled] [ref=e74]:
            - generic [ref=e75]: 2L
          - button "i1, empty" [disabled] [ref=e76]
          - button "j1, empty" [disabled] [ref=e77]
          - button "3W, k1, triple word, empty" [disabled] [ref=e78]:
            - generic [ref=e79]: 3W
          - button "l1, empty" [disabled] [ref=e80]
          - button "m1, empty" [disabled] [ref=e81]
          - button "n1, empty" [disabled] [ref=e82]
          - button "2L, o1, double letter, empty" [disabled] [ref=e83]:
            - generic [ref=e84]: 2L
          - generic [ref=e85]: "2"
          - button "a2, empty" [disabled] [ref=e86]
          - button "b2, empty" [disabled] [ref=e87]
          - button "c2, empty" [disabled] [ref=e88]
          - button "2L, d2, double letter, empty" [disabled] [ref=e89]:
            - generic [ref=e90]: 2L
          - button "e2, empty" [disabled] [ref=e91]
          - button "f2, empty" [disabled] [ref=e92]
          - button "2W, g2, double word, empty" [disabled] [ref=e93]:
            - generic [ref=e94]: 2W
          - button "h2, empty" [disabled] [ref=e95]
          - button "2W, i2, double word, empty" [disabled] [ref=e96]:
            - generic [ref=e97]: 2W
          - button "j2, empty" [disabled] [ref=e98]
          - button "k2, empty" [disabled] [ref=e99]
          - button "2L, l2, double letter, empty" [disabled] [ref=e100]:
            - generic [ref=e101]: 2L
          - button "m2, empty" [disabled] [ref=e102]
          - button "n2, empty" [disabled] [ref=e103]
          - button "o2, empty" [disabled] [ref=e104]
          - generic [ref=e105]: "3"
          - button "a3, empty" [disabled] [ref=e106]
          - button "b3, empty" [disabled] [ref=e107]
          - button "c3, empty" [disabled] [ref=e108]
          - button "d3, empty" [disabled] [ref=e109]
          - button "3L, e3, triple letter, empty" [disabled] [ref=e110]:
            - generic [ref=e111]: 3L
          - button "f3, empty" [disabled] [ref=e112]
          - button "g3, empty" [disabled] [ref=e113]
          - button "h3, empty" [disabled] [ref=e114]
          - button "i3, empty" [disabled] [ref=e115]
          - button "j3, empty" [disabled] [ref=e116]
          - button "3L, k3, triple letter, empty" [disabled] [ref=e117]:
            - generic [ref=e118]: 3L
          - button "l3, empty" [disabled] [ref=e119]
          - button "m3, empty" [disabled] [ref=e120]
          - button "n3, empty" [disabled] [ref=e121]
          - button "o3, empty" [disabled] [ref=e122]
          - generic [ref=e123]: "4"
          - button "a4, empty" [disabled] [ref=e124]
          - button "2L, b4, double letter, empty" [disabled] [ref=e125]:
            - generic [ref=e126]: 2L
          - button "c4, empty" [disabled] [ref=e127]
          - button "2W, d4, double word, empty" [disabled] [ref=e128]:
            - generic [ref=e129]: 2W
          - button "e4, empty" [disabled] [ref=e130]
          - button "f4, empty" [disabled] [ref=e131]
          - button "g4, empty" [disabled] [ref=e132]
          - button "h4, empty" [disabled] [ref=e133]
          - button "i4, empty" [disabled] [ref=e134]
          - button "j4, empty" [disabled] [ref=e135]
          - button "k4, empty" [disabled] [ref=e136]
          - button "2W, l4, double word, empty" [disabled] [ref=e137]:
            - generic [ref=e138]: 2W
          - button "m4, empty" [disabled] [ref=e139]
          - button "2L, n4, double letter, empty" [disabled] [ref=e140]:
            - generic [ref=e141]: 2L
          - button "o4, empty" [disabled] [ref=e142]
          - generic [ref=e143]: "5"
          - button "3W, a5, triple word, empty" [disabled] [ref=e144]:
            - generic [ref=e145]: 3W
          - button "b5, empty" [disabled] [ref=e146]
          - button "3L, c5, triple letter, empty" [disabled] [ref=e147]:
            - generic [ref=e148]: 3L
          - button "d5, empty" [disabled] [ref=e149]
          - button "e5, empty" [disabled] [ref=e150]
          - button "f5, empty" [disabled] [ref=e151]
          - button "2L, g5, double letter, empty" [disabled] [ref=e152]:
            - generic [ref=e153]: 2L
          - button "h5, empty" [disabled] [ref=e154]
          - button "2L, i5, double letter, empty" [disabled] [ref=e155]:
            - generic [ref=e156]: 2L
          - button "j5, empty" [disabled] [ref=e157]
          - button "k5, empty" [disabled] [ref=e158]
          - button "l5, empty" [disabled] [ref=e159]
          - button "3L, m5, triple letter, empty" [disabled] [ref=e160]:
            - generic [ref=e161]: 3L
          - button "n5, empty" [disabled] [ref=e162]
          - button "3W, o5, triple word, empty" [disabled] [ref=e163]:
            - generic [ref=e164]: 3W
          - generic [ref=e165]: "6"
          - button "a6, empty" [disabled] [ref=e166]
          - button "b6, empty" [disabled] [ref=e167]
          - button "c6, empty" [disabled] [ref=e168]
          - button "d6, empty" [disabled] [ref=e169]
          - button "e6, empty" [disabled] [ref=e170]
          - button "f6, empty" [disabled] [ref=e171]
          - button "g6, empty" [disabled] [ref=e172]
          - button "3L, h6, triple letter, empty" [disabled] [ref=e173]:
            - generic [ref=e174]: 3L
          - button "i6, empty" [disabled] [ref=e175]
          - button "j6, empty" [disabled] [ref=e176]
          - button "k6, empty" [disabled] [ref=e177]
          - button "l6, empty" [disabled] [ref=e178]
          - button "m6, empty" [disabled] [ref=e179]
          - button "n6, empty" [disabled] [ref=e180]
          - button "o6, empty" [disabled] [ref=e181]
          - generic [ref=e182]: "7"
          - button "a7, empty" [disabled] [ref=e183]
          - button "2W, b7, double word, empty" [disabled] [ref=e184]:
            - generic [ref=e185]: 2W
          - button "c7, empty" [disabled] [ref=e186]
          - button "d7, empty" [disabled] [ref=e187]
          - button "2L, e7, double letter, empty" [disabled] [ref=e188]:
            - generic [ref=e189]: 2L
          - button "f7, empty" [disabled] [ref=e190]
          - button "2L, g7, double letter, empty" [disabled] [ref=e191]:
            - generic [ref=e192]: 2L
          - button "h7, empty" [disabled] [ref=e193]
          - button "2L, i7, double letter, empty" [disabled] [ref=e194]:
            - generic [ref=e195]: 2L
          - button "j7, empty" [disabled] [ref=e196]
          - button "2L, k7, double letter, empty" [disabled] [ref=e197]:
            - generic [ref=e198]: 2L
          - button "l7, empty" [disabled] [ref=e199]
          - button "m7, empty" [disabled] [ref=e200]
          - button "2W, n7, double word, empty" [disabled] [ref=e201]:
            - generic [ref=e202]: 2W
          - button "o7, empty" [disabled] [ref=e203]
          - generic [ref=e204]: "8"
          - button "2L, a8, double letter, empty" [disabled] [ref=e205]:
            - generic [ref=e206]: 2L
          - button "b8, empty" [disabled] [ref=e207]
          - button "c8, empty" [disabled] [ref=e208]
          - button "d8, empty" [disabled] [ref=e209]
          - button "e8, empty" [disabled] [ref=e210]
          - button "3L, f8, triple letter, empty" [disabled] [ref=e211]:
            - generic [ref=e212]: 3L
          - button "C 3, g8, committed" [disabled] [ref=e213]:
            - generic [ref=e214]: C
            - generic [ref=e215]: "3"
          - button "A 1, h8, committed" [disabled] [ref=e216]:
            - generic [ref=e217]: A
            - generic [ref=e218]: "1"
          - button "T 1, i8, committed" [disabled] [ref=e219]:
            - generic [ref=e220]: T
            - generic [ref=e221]: "1"
          - button "3L, j8, triple letter, empty" [disabled] [ref=e222]:
            - generic [ref=e223]: 3L
          - button "k8, empty" [disabled] [ref=e224]
          - button "l8, empty" [disabled] [ref=e225]
          - button "m8, empty" [disabled] [ref=e226]
          - button "n8, empty" [disabled] [ref=e227]
          - button "2L, o8, double letter, empty" [disabled] [ref=e228]:
            - generic [ref=e229]: 2L
          - generic [ref=e230]: "9"
          - button "a9, empty" [disabled] [ref=e231]
          - button "2W, b9, double word, empty" [disabled] [ref=e232]:
            - generic [ref=e233]: 2W
          - button "c9, empty" [disabled] [ref=e234]
          - button "d9, empty" [disabled] [ref=e235]
          - button "2L, e9, double letter, empty" [disabled] [ref=e236]:
            - generic [ref=e237]: 2L
          - button "f9, empty" [disabled] [ref=e238]
          - button "2L, g9, double letter, empty" [disabled] [ref=e239]:
            - generic [ref=e240]: 2L
          - button "h9, empty" [disabled] [ref=e241]
          - button "O 1, i9, committed" [disabled] [ref=e242]:
            - generic [ref=e243]: O
            - generic [ref=e244]: "1"
          - button "j9, empty" [disabled] [ref=e245]
          - button "2L, k9, double letter, empty" [disabled] [ref=e246]:
            - generic [ref=e247]: 2L
          - button "l9, empty" [disabled] [ref=e248]
          - button "m9, empty" [disabled] [ref=e249]
          - button "2W, n9, double word, empty" [disabled] [ref=e250]:
            - generic [ref=e251]: 2W
          - button "o9, empty" [disabled] [ref=e252]
          - generic [ref=e253]: "10"
          - button "a10, empty" [disabled] [ref=e254]
          - button "b10, empty" [disabled] [ref=e255]
          - button "c10, empty" [disabled] [ref=e256]
          - button "d10, empty" [disabled] [ref=e257]
          - button "e10, empty" [disabled] [ref=e258]
          - button "f10, empty" [disabled] [ref=e259]
          - button "g10, empty" [disabled] [ref=e260]
          - button "3L, h10, triple letter, empty" [disabled] [ref=e261]:
            - generic [ref=e262]: 3L
          - button "E 1, i10, committed" [disabled] [ref=e263]:
            - generic [ref=e264]: E
            - generic [ref=e265]: "1"
          - button "j10, empty" [disabled] [ref=e266]
          - button "k10, empty" [disabled] [ref=e267]
          - button "l10, empty" [disabled] [ref=e268]
          - button "m10, empty" [disabled] [ref=e269]
          - button "n10, empty" [disabled] [ref=e270]
          - button "o10, empty" [disabled] [ref=e271]
          - generic [ref=e272]: "11"
          - button "3W, a11, triple word, empty" [disabled] [ref=e273]:
            - generic [ref=e274]: 3W
          - button "b11, empty" [disabled] [ref=e275]
          - button "3L, c11, triple letter, empty" [disabled] [ref=e276]:
            - generic [ref=e277]: 3L
          - button "d11, empty" [disabled] [ref=e278]
          - button "e11, empty" [disabled] [ref=e279]
          - button "f11, empty" [disabled] [ref=e280]
          - button "2L, g11, double letter, empty" [disabled] [ref=e281]:
            - generic [ref=e282]: 2L
          - button "h11, empty" [disabled] [ref=e283]
          - button "2L, i11, double letter, empty" [disabled] [ref=e284]:
            - generic [ref=e285]: 2L
          - button "j11, empty" [disabled] [ref=e286]
          - button "k11, empty" [disabled] [ref=e287]
          - button "l11, empty" [disabled] [ref=e288]
          - button "3L, m11, triple letter, empty" [disabled] [ref=e289]:
            - generic [ref=e290]: 3L
          - button "n11, empty" [disabled] [ref=e291]
          - button "3W, o11, triple word, empty" [disabled] [ref=e292]:
            - generic [ref=e293]: 3W
          - generic [ref=e294]: "12"
          - button "a12, empty" [disabled] [ref=e295]
          - button "2L, b12, double letter, empty" [disabled] [ref=e296]:
            - generic [ref=e297]: 2L
          - button "c12, empty" [disabled] [ref=e298]
          - button "2W, d12, double word, empty" [disabled] [ref=e299]:
            - generic [ref=e300]: 2W
          - button "e12, empty" [disabled] [ref=e301]
          - button "f12, empty" [disabled] [ref=e302]
          - button "g12, empty" [disabled] [ref=e303]
          - button "h12, empty" [disabled] [ref=e304]
          - button "i12, empty" [disabled] [ref=e305]
          - button "j12, empty" [disabled] [ref=e306]
          - button "k12, empty" [disabled] [ref=e307]
          - button "2W, l12, double word, empty" [disabled] [ref=e308]:
            - generic [ref=e309]: 2W
          - button "m12, empty" [disabled] [ref=e310]
          - button "2L, n12, double letter, empty" [disabled] [ref=e311]:
            - generic [ref=e312]: 2L
          - button "o12, empty" [disabled] [ref=e313]
          - generic [ref=e314]: "13"
          - button "a13, empty" [disabled] [ref=e315]
          - button "b13, empty" [disabled] [ref=e316]
          - button "c13, empty" [disabled] [ref=e317]
          - button "d13, empty" [disabled] [ref=e318]
          - button "3L, e13, triple letter, empty" [disabled] [ref=e319]:
            - generic [ref=e320]: 3L
          - button "f13, empty" [disabled] [ref=e321]
          - button "g13, empty" [disabled] [ref=e322]
          - button "h13, empty" [disabled] [ref=e323]
          - button "i13, empty" [disabled] [ref=e324]
          - button "j13, empty" [disabled] [ref=e325]
          - button "3L, k13, triple letter, empty" [disabled] [ref=e326]:
            - generic [ref=e327]: 3L
          - button "l13, empty" [disabled] [ref=e328]
          - button "m13, empty" [disabled] [ref=e329]
          - button "n13, empty" [disabled] [ref=e330]
          - button "o13, empty" [disabled] [ref=e331]
          - generic [ref=e332]: "14"
          - button "a14, empty" [disabled] [ref=e333]
          - button "b14, empty" [disabled] [ref=e334]
          - button "c14, empty" [disabled] [ref=e335]
          - button "2L, d14, double letter, empty" [disabled] [ref=e336]:
            - generic [ref=e337]: 2L
          - button "e14, empty" [disabled] [ref=e338]
          - button "f14, empty" [disabled] [ref=e339]
          - button "2W, g14, double word, empty" [disabled] [ref=e340]:
            - generic [ref=e341]: 2W
          - button "h14, empty" [disabled] [ref=e342]
          - button "2W, i14, double word, empty" [disabled] [ref=e343]:
            - generic [ref=e344]: 2W
          - button "j14, empty" [disabled] [ref=e345]
          - button "k14, empty" [disabled] [ref=e346]
          - button "2L, l14, double letter, empty" [disabled] [ref=e347]:
            - generic [ref=e348]: 2L
          - button "m14, empty" [disabled] [ref=e349]
          - button "n14, empty" [disabled] [ref=e350]
          - button "o14, empty" [disabled] [ref=e351]
          - generic [ref=e352]: "15"
          - button "2L, a15, double letter, empty" [disabled] [ref=e353]:
            - generic [ref=e354]: 2L
          - button "b15, empty" [disabled] [ref=e355]
          - button "c15, empty" [disabled] [ref=e356]
          - button "d15, empty" [disabled] [ref=e357]
          - button "3W, e15, triple word, empty" [disabled] [ref=e358]:
            - generic [ref=e359]: 3W
          - button "f15, empty" [disabled] [ref=e360]
          - button "g15, empty" [disabled] [ref=e361]
          - button "2L, h15, double letter, empty" [disabled] [ref=e362]:
            - generic [ref=e363]: 2L
          - button "i15, empty" [disabled] [ref=e364]
          - button "j15, empty" [disabled] [ref=e365]
          - button "3W, k15, triple word, empty" [disabled] [ref=e366]:
            - generic [ref=e367]: 3W
          - button "l15, empty" [disabled] [ref=e368]
          - button "m15, empty" [disabled] [ref=e369]
          - button "n15, empty" [disabled] [ref=e370]
          - button "2L, o15, double letter, empty" [disabled] [ref=e371]:
            - generic [ref=e372]: 2L
      - generic [ref=e373]:
        - generic [ref=e374]:
          - img "Whole board overview; outline shows the enlarged area" [ref=e375]
          - group "View a board region" [ref=e602]:
            - button "View a1 to e5" [ref=e603] [cursor=pointer]
            - button "View f1 to j5" [ref=e604] [cursor=pointer]
            - button "View k1 to o5" [ref=e605] [cursor=pointer]
            - button "View a6 to e10" [ref=e606] [cursor=pointer]
            - button "View f6 to j10" [ref=e607] [cursor=pointer]
            - button "View k6 to o10" [ref=e608] [cursor=pointer]
            - button "View a11 to e15" [ref=e609] [cursor=pointer]
            - button "View f11 to j15" [ref=e610] [cursor=pointer]
            - button "View k11 to o15" [ref=e611] [cursor=pointer]
        - generic [ref=e612]:
          - generic [ref=e613]:
            - button "Fit board" [ref=e614] [cursor=pointer]:
              - paragraph [ref=e617]: Fit board
            - button "Enlarge board" [pressed] [ref=e618] [cursor=pointer]:
              - paragraph [ref=e621]: Enlarge board
          - paragraph [ref=e622]: A 1, h8, committed
          - 'button "Board map: locate a square" [ref=e623] [cursor=pointer]': Map
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