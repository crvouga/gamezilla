# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-puzzle--word-list-unavailable dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  77142 pixels (ratio 0.24 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-puzzle/word-list-unavailable-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-puzzle/word-list-unavailable-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 77142 pixels (ratio 0.24 of all image pixels) are different.
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
  - 77142 pixels (ratio 0.24 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e10]:
    - paragraph [ref=e11]: Score at least 20 points in one move.
    - status [ref=e12]: The word list could not load. Your tiles are kept. Retry to check and play your word.
    - button "Retry word list" [ref=e13] [cursor=pointer]:
      - paragraph [ref=e16]: Retry word list
    - generic [ref=e17]:
      - button "Play word" [disabled] [ref=e18]:
        - paragraph [ref=e21]: Play word
      - button "Recall tiles" [disabled] [ref=e22]:
        - paragraph [ref=e25]: Recall tiles
    - group "Your rack" [ref=e26]:
      - button "A, 1 points" [ref=e27] [cursor=pointer]:
        - generic [ref=e28]: A
        - generic [ref=e29]: "1"
      - button "E, 1 points" [ref=e30] [cursor=pointer]:
        - generic [ref=e31]: E
        - generic [ref=e32]: "1"
      - button "S, 1 points" [ref=e33] [cursor=pointer]:
        - generic [ref=e34]: S
        - generic [ref=e35]: "1"
      - button "T, 1 points" [ref=e36] [cursor=pointer]:
        - generic [ref=e37]: T
        - generic [ref=e38]: "1"
      - button "Blank, 0 points" [ref=e39] [cursor=pointer]:
        - generic [ref=e40]: "0"
      - button "R, 1 points" [ref=e41] [cursor=pointer]:
        - generic [ref=e42]: R
        - generic [ref=e43]: "1"
      - button "N, 1 points" [ref=e44] [cursor=pointer]:
        - generic [ref=e45]: "N"
        - generic [ref=e46]: "1"
    - paragraph [ref=e47]: "2L/3L: double/triple letter. 2W/3W: double/triple word."
    - generic [ref=e48]:
      - generic [ref=e49]:
        - button "Fit board" [pressed] [ref=e50] [cursor=pointer]:
          - paragraph [ref=e53]: Fit board
        - button "Enlarge board" [ref=e54] [cursor=pointer]:
          - paragraph [ref=e57]: Enlarge board
      - region "Scrollable word board" [ref=e59]:
        - group "Puzzle board, fifteen columns and fifteen rows" [ref=e60]:
          - generic [ref=e62]: a
          - generic [ref=e63]: b
          - generic [ref=e64]: c
          - generic [ref=e65]: d
          - generic [ref=e66]: e
          - generic [ref=e67]: f
          - generic [ref=e68]: g
          - generic [ref=e69]: h
          - generic [ref=e70]: i
          - generic [ref=e71]: j
          - generic [ref=e72]: k
          - generic [ref=e73]: l
          - generic [ref=e74]: m
          - generic [ref=e75]: "n"
          - generic [ref=e76]: o
          - generic [ref=e77]: "1"
          - button "2L, a1, double letter, empty" [ref=e78] [cursor=pointer]:
            - generic [ref=e79]: 2L
          - button "b1, empty" [ref=e80] [cursor=pointer]
          - button "c1, empty" [ref=e81] [cursor=pointer]
          - button "d1, empty" [ref=e82] [cursor=pointer]
          - button "3W, e1, triple word, empty" [ref=e83] [cursor=pointer]:
            - generic [ref=e84]: 3W
          - button "f1, empty" [ref=e85] [cursor=pointer]
          - button "g1, empty" [ref=e86] [cursor=pointer]
          - button "2L, h1, double letter, empty" [ref=e87] [cursor=pointer]:
            - generic [ref=e88]: 2L
          - button "i1, empty" [ref=e89] [cursor=pointer]
          - button "j1, empty" [ref=e90] [cursor=pointer]
          - button "3W, k1, triple word, empty" [ref=e91] [cursor=pointer]:
            - generic [ref=e92]: 3W
          - button "l1, empty" [ref=e93] [cursor=pointer]
          - button "m1, empty" [ref=e94] [cursor=pointer]
          - button "n1, empty" [ref=e95] [cursor=pointer]
          - button "2L, o1, double letter, empty" [ref=e96] [cursor=pointer]:
            - generic [ref=e97]: 2L
          - generic [ref=e98]: "2"
          - button "a2, empty" [ref=e99] [cursor=pointer]
          - button "b2, empty" [ref=e100] [cursor=pointer]
          - button "c2, empty" [ref=e101] [cursor=pointer]
          - button "2L, d2, double letter, empty" [ref=e102] [cursor=pointer]:
            - generic [ref=e103]: 2L
          - button "e2, empty" [ref=e104] [cursor=pointer]
          - button "f2, empty" [ref=e105] [cursor=pointer]
          - button "2W, g2, double word, empty" [ref=e106] [cursor=pointer]:
            - generic [ref=e107]: 2W
          - button "h2, empty" [ref=e108] [cursor=pointer]
          - button "2W, i2, double word, empty" [ref=e109] [cursor=pointer]:
            - generic [ref=e110]: 2W
          - button "j2, empty" [ref=e111] [cursor=pointer]
          - button "k2, empty" [ref=e112] [cursor=pointer]
          - button "2L, l2, double letter, empty" [ref=e113] [cursor=pointer]:
            - generic [ref=e114]: 2L
          - button "m2, empty" [ref=e115] [cursor=pointer]
          - button "n2, empty" [ref=e116] [cursor=pointer]
          - button "o2, empty" [ref=e117] [cursor=pointer]
          - generic [ref=e118]: "3"
          - button "a3, empty" [ref=e119] [cursor=pointer]
          - button "b3, empty" [ref=e120] [cursor=pointer]
          - button "c3, empty" [ref=e121] [cursor=pointer]
          - button "d3, empty" [ref=e122] [cursor=pointer]
          - button "3L, e3, triple letter, empty" [ref=e123] [cursor=pointer]:
            - generic [ref=e124]: 3L
          - button "f3, empty" [ref=e125] [cursor=pointer]
          - button "g3, empty" [ref=e126] [cursor=pointer]
          - button "h3, empty" [ref=e127] [cursor=pointer]
          - button "i3, empty" [ref=e128] [cursor=pointer]
          - button "j3, empty" [ref=e129] [cursor=pointer]
          - button "3L, k3, triple letter, empty" [ref=e130] [cursor=pointer]:
            - generic [ref=e131]: 3L
          - button "l3, empty" [ref=e132] [cursor=pointer]
          - button "m3, empty" [ref=e133] [cursor=pointer]
          - button "n3, empty" [ref=e134] [cursor=pointer]
          - button "o3, empty" [ref=e135] [cursor=pointer]
          - generic [ref=e136]: "4"
          - button "a4, empty" [ref=e137] [cursor=pointer]
          - button "2L, b4, double letter, empty" [ref=e138] [cursor=pointer]:
            - generic [ref=e139]: 2L
          - button "c4, empty" [ref=e140] [cursor=pointer]
          - button "2W, d4, double word, empty" [ref=e141] [cursor=pointer]:
            - generic [ref=e142]: 2W
          - button "e4, empty" [ref=e143] [cursor=pointer]
          - button "f4, empty" [ref=e144] [cursor=pointer]
          - button "g4, empty" [ref=e145] [cursor=pointer]
          - button "h4, empty" [ref=e146] [cursor=pointer]
          - button "i4, empty" [ref=e147] [cursor=pointer]
          - button "j4, empty" [ref=e148] [cursor=pointer]
          - button "k4, empty" [ref=e149] [cursor=pointer]
          - button "2W, l4, double word, empty" [ref=e150] [cursor=pointer]:
            - generic [ref=e151]: 2W
          - button "m4, empty" [ref=e152] [cursor=pointer]
          - button "2L, n4, double letter, empty" [ref=e153] [cursor=pointer]:
            - generic [ref=e154]: 2L
          - button "o4, empty" [ref=e155] [cursor=pointer]
          - generic [ref=e156]: "5"
          - button "3W, a5, triple word, empty" [ref=e157] [cursor=pointer]:
            - generic [ref=e158]: 3W
          - button "b5, empty" [ref=e159] [cursor=pointer]
          - button "3L, c5, triple letter, empty" [ref=e160] [cursor=pointer]:
            - generic [ref=e161]: 3L
          - button "d5, empty" [ref=e162] [cursor=pointer]
          - button "e5, empty" [ref=e163] [cursor=pointer]
          - button "f5, empty" [ref=e164] [cursor=pointer]
          - button "2L, g5, double letter, empty" [ref=e165] [cursor=pointer]:
            - generic [ref=e166]: 2L
          - button "h5, empty" [ref=e167] [cursor=pointer]
          - button "2L, i5, double letter, empty" [ref=e168] [cursor=pointer]:
            - generic [ref=e169]: 2L
          - button "j5, empty" [ref=e170] [cursor=pointer]
          - button "k5, empty" [ref=e171] [cursor=pointer]
          - button "l5, empty" [ref=e172] [cursor=pointer]
          - button "3L, m5, triple letter, empty" [ref=e173] [cursor=pointer]:
            - generic [ref=e174]: 3L
          - button "n5, empty" [ref=e175] [cursor=pointer]
          - button "3W, o5, triple word, empty" [ref=e176] [cursor=pointer]:
            - generic [ref=e177]: 3W
          - generic [ref=e178]: "6"
          - button "a6, empty" [ref=e179] [cursor=pointer]
          - button "b6, empty" [ref=e180] [cursor=pointer]
          - button "c6, empty" [ref=e181] [cursor=pointer]
          - button "d6, empty" [ref=e182] [cursor=pointer]
          - button "e6, empty" [ref=e183] [cursor=pointer]
          - button "f6, empty" [ref=e184] [cursor=pointer]
          - button "g6, empty" [ref=e185] [cursor=pointer]
          - button "3L, h6, triple letter, empty" [ref=e186] [cursor=pointer]:
            - generic [ref=e187]: 3L
          - button "i6, empty" [ref=e188] [cursor=pointer]
          - button "j6, empty" [ref=e189] [cursor=pointer]
          - button "k6, empty" [ref=e190] [cursor=pointer]
          - button "l6, empty" [ref=e191] [cursor=pointer]
          - button "m6, empty" [ref=e192] [cursor=pointer]
          - button "n6, empty" [ref=e193] [cursor=pointer]
          - button "o6, empty" [ref=e194] [cursor=pointer]
          - generic [ref=e195]: "7"
          - button "a7, empty" [ref=e196] [cursor=pointer]
          - button "2W, b7, double word, empty" [ref=e197] [cursor=pointer]:
            - generic [ref=e198]: 2W
          - button "c7, empty" [ref=e199] [cursor=pointer]
          - button "d7, empty" [ref=e200] [cursor=pointer]
          - button "2L, e7, double letter, empty" [ref=e201] [cursor=pointer]:
            - generic [ref=e202]: 2L
          - button "f7, empty" [ref=e203] [cursor=pointer]
          - button "2L, g7, double letter, empty" [ref=e204] [cursor=pointer]:
            - generic [ref=e205]: 2L
          - button "h7, empty" [ref=e206] [cursor=pointer]
          - button "2L, i7, double letter, empty" [ref=e207] [cursor=pointer]:
            - generic [ref=e208]: 2L
          - button "j7, empty" [ref=e209] [cursor=pointer]
          - button "2L, k7, double letter, empty" [ref=e210] [cursor=pointer]:
            - generic [ref=e211]: 2L
          - button "l7, empty" [ref=e212] [cursor=pointer]
          - button "m7, empty" [ref=e213] [cursor=pointer]
          - button "2W, n7, double word, empty" [ref=e214] [cursor=pointer]:
            - generic [ref=e215]: 2W
          - button "o7, empty" [ref=e216] [cursor=pointer]
          - generic [ref=e217]: "8"
          - button "2L, a8, double letter, empty" [ref=e218] [cursor=pointer]:
            - generic [ref=e219]: 2L
          - button "b8, empty" [ref=e220] [cursor=pointer]
          - button "c8, empty" [ref=e221] [cursor=pointer]
          - button "d8, empty" [ref=e222] [cursor=pointer]
          - button "e8, empty" [ref=e223] [cursor=pointer]
          - button "3L, f8, triple letter, empty" [ref=e224] [cursor=pointer]:
            - generic [ref=e225]: 3L
          - button "C 3, g8, committed" [disabled] [ref=e226]:
            - generic [ref=e227]: C
          - button "A 1, h8, committed" [disabled] [ref=e228]:
            - generic [ref=e229]: A
          - button "T 1, i8, committed" [disabled] [ref=e230]:
            - generic [ref=e231]: T
          - button "3L, j8, triple letter, empty" [ref=e232] [cursor=pointer]:
            - generic [ref=e233]: 3L
          - button "k8, empty" [ref=e234] [cursor=pointer]
          - button "l8, empty" [ref=e235] [cursor=pointer]
          - button "m8, empty" [ref=e236] [cursor=pointer]
          - button "n8, empty" [ref=e237] [cursor=pointer]
          - button "2L, o8, double letter, empty" [ref=e238] [cursor=pointer]:
            - generic [ref=e239]: 2L
          - generic [ref=e240]: "9"
          - button "a9, empty" [ref=e241] [cursor=pointer]
          - button "2W, b9, double word, empty" [ref=e242] [cursor=pointer]:
            - generic [ref=e243]: 2W
          - button "c9, empty" [ref=e244] [cursor=pointer]
          - button "d9, empty" [ref=e245] [cursor=pointer]
          - button "2L, e9, double letter, empty" [ref=e246] [cursor=pointer]:
            - generic [ref=e247]: 2L
          - button "f9, empty" [ref=e248] [cursor=pointer]
          - button "2L, g9, double letter, empty" [ref=e249] [cursor=pointer]:
            - generic [ref=e250]: 2L
          - button "h9, empty" [ref=e251] [cursor=pointer]
          - button "O 1, i9, committed" [disabled] [ref=e252]:
            - generic [ref=e253]: O
          - button "j9, empty" [ref=e254] [cursor=pointer]
          - button "2L, k9, double letter, empty" [ref=e255] [cursor=pointer]:
            - generic [ref=e256]: 2L
          - button "l9, empty" [ref=e257] [cursor=pointer]
          - button "m9, empty" [ref=e258] [cursor=pointer]
          - button "2W, n9, double word, empty" [ref=e259] [cursor=pointer]:
            - generic [ref=e260]: 2W
          - button "o9, empty" [ref=e261] [cursor=pointer]
          - generic [ref=e262]: "10"
          - button "a10, empty" [ref=e263] [cursor=pointer]
          - button "b10, empty" [ref=e264] [cursor=pointer]
          - button "c10, empty" [ref=e265] [cursor=pointer]
          - button "d10, empty" [ref=e266] [cursor=pointer]
          - button "e10, empty" [ref=e267] [cursor=pointer]
          - button "f10, empty" [ref=e268] [cursor=pointer]
          - button "g10, empty" [ref=e269] [cursor=pointer]
          - button "3L, h10, triple letter, empty" [ref=e270] [cursor=pointer]:
            - generic [ref=e271]: 3L
          - button "E 1, i10, committed" [disabled] [ref=e272]:
            - generic [ref=e273]: E
          - button "j10, empty" [ref=e274] [cursor=pointer]
          - button "k10, empty" [ref=e275] [cursor=pointer]
          - button "l10, empty" [ref=e276] [cursor=pointer]
          - button "m10, empty" [ref=e277] [cursor=pointer]
          - button "n10, empty" [ref=e278] [cursor=pointer]
          - button "o10, empty" [ref=e279] [cursor=pointer]
          - generic [ref=e280]: "11"
          - button "3W, a11, triple word, empty" [ref=e281] [cursor=pointer]:
            - generic [ref=e282]: 3W
          - button "b11, empty" [ref=e283] [cursor=pointer]
          - button "3L, c11, triple letter, empty" [ref=e284] [cursor=pointer]:
            - generic [ref=e285]: 3L
          - button "d11, empty" [ref=e286] [cursor=pointer]
          - button "e11, empty" [ref=e287] [cursor=pointer]
          - button "f11, empty" [ref=e288] [cursor=pointer]
          - button "2L, g11, double letter, empty" [ref=e289] [cursor=pointer]:
            - generic [ref=e290]: 2L
          - button "h11, empty" [ref=e291] [cursor=pointer]
          - button "2L, i11, double letter, empty" [ref=e292] [cursor=pointer]:
            - generic [ref=e293]: 2L
          - button "j11, empty" [ref=e294] [cursor=pointer]
          - button "k11, empty" [ref=e295] [cursor=pointer]
          - button "l11, empty" [ref=e296] [cursor=pointer]
          - button "3L, m11, triple letter, empty" [ref=e297] [cursor=pointer]:
            - generic [ref=e298]: 3L
          - button "n11, empty" [ref=e299] [cursor=pointer]
          - button "3W, o11, triple word, empty" [ref=e300] [cursor=pointer]:
            - generic [ref=e301]: 3W
          - generic [ref=e302]: "12"
          - button "a12, empty" [ref=e303] [cursor=pointer]
          - button "2L, b12, double letter, empty" [ref=e304] [cursor=pointer]:
            - generic [ref=e305]: 2L
          - button "c12, empty" [ref=e306] [cursor=pointer]
          - button "2W, d12, double word, empty" [ref=e307] [cursor=pointer]:
            - generic [ref=e308]: 2W
          - button "e12, empty" [ref=e309] [cursor=pointer]
          - button "f12, empty" [ref=e310] [cursor=pointer]
          - button "g12, empty" [ref=e311] [cursor=pointer]
          - button "h12, empty" [ref=e312] [cursor=pointer]
          - button "i12, empty" [ref=e313] [cursor=pointer]
          - button "j12, empty" [ref=e314] [cursor=pointer]
          - button "k12, empty" [ref=e315] [cursor=pointer]
          - button "2W, l12, double word, empty" [ref=e316] [cursor=pointer]:
            - generic [ref=e317]: 2W
          - button "m12, empty" [ref=e318] [cursor=pointer]
          - button "2L, n12, double letter, empty" [ref=e319] [cursor=pointer]:
            - generic [ref=e320]: 2L
          - button "o12, empty" [ref=e321] [cursor=pointer]
          - generic [ref=e322]: "13"
          - button "a13, empty" [ref=e323] [cursor=pointer]
          - button "b13, empty" [ref=e324] [cursor=pointer]
          - button "c13, empty" [ref=e325] [cursor=pointer]
          - button "d13, empty" [ref=e326] [cursor=pointer]
          - button "3L, e13, triple letter, empty" [ref=e327] [cursor=pointer]:
            - generic [ref=e328]: 3L
          - button "f13, empty" [ref=e329] [cursor=pointer]
          - button "g13, empty" [ref=e330] [cursor=pointer]
          - button "h13, empty" [ref=e331] [cursor=pointer]
          - button "i13, empty" [ref=e332] [cursor=pointer]
          - button "j13, empty" [ref=e333] [cursor=pointer]
          - button "3L, k13, triple letter, empty" [ref=e334] [cursor=pointer]:
            - generic [ref=e335]: 3L
          - button "l13, empty" [ref=e336] [cursor=pointer]
          - button "m13, empty" [ref=e337] [cursor=pointer]
          - button "n13, empty" [ref=e338] [cursor=pointer]
          - button "o13, empty" [ref=e339] [cursor=pointer]
          - generic [ref=e340]: "14"
          - button "a14, empty" [ref=e341] [cursor=pointer]
          - button "b14, empty" [ref=e342] [cursor=pointer]
          - button "c14, empty" [ref=e343] [cursor=pointer]
          - button "2L, d14, double letter, empty" [ref=e344] [cursor=pointer]:
            - generic [ref=e345]: 2L
          - button "e14, empty" [ref=e346] [cursor=pointer]
          - button "f14, empty" [ref=e347] [cursor=pointer]
          - button "2W, g14, double word, empty" [ref=e348] [cursor=pointer]:
            - generic [ref=e349]: 2W
          - button "h14, empty" [ref=e350] [cursor=pointer]
          - button "2W, i14, double word, empty" [ref=e351] [cursor=pointer]:
            - generic [ref=e352]: 2W
          - button "j14, empty" [ref=e353] [cursor=pointer]
          - button "k14, empty" [ref=e354] [cursor=pointer]
          - button "2L, l14, double letter, empty" [ref=e355] [cursor=pointer]:
            - generic [ref=e356]: 2L
          - button "m14, empty" [ref=e357] [cursor=pointer]
          - button "n14, empty" [ref=e358] [cursor=pointer]
          - button "o14, empty" [ref=e359] [cursor=pointer]
          - generic [ref=e360]: "15"
          - button "2L, a15, double letter, empty" [ref=e361] [cursor=pointer]:
            - generic [ref=e362]: 2L
          - button "b15, empty" [ref=e363] [cursor=pointer]
          - button "c15, empty" [ref=e364] [cursor=pointer]
          - button "d15, empty" [ref=e365] [cursor=pointer]
          - button "3W, e15, triple word, empty" [ref=e366] [cursor=pointer]:
            - generic [ref=e367]: 3W
          - button "f15, empty" [ref=e368] [cursor=pointer]
          - button "g15, empty" [ref=e369] [cursor=pointer]
          - button "2L, h15, double letter, empty" [ref=e370] [cursor=pointer]:
            - generic [ref=e371]: 2L
          - button "i15, empty" [ref=e372] [cursor=pointer]
          - button "j15, empty" [ref=e373] [cursor=pointer]
          - button "3W, k15, triple word, empty" [ref=e374] [cursor=pointer]:
            - generic [ref=e375]: 3W
          - button "l15, empty" [ref=e376] [cursor=pointer]
          - button "m15, empty" [ref=e377] [cursor=pointer]
          - button "n15, empty" [ref=e378] [cursor=pointer]
          - button "2L, o15, double letter, empty" [ref=e379] [cursor=pointer]:
            - generic [ref=e380]: 2L
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