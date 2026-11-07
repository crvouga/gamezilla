# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: word-tiles-round-five.checks.ts >> screens-games-word-tiles-puzzle--enlarged-blank regression word-tiles-cramped-precision-window light-1440
- Location: tests/storybook/word-tiles-round-five.checks.ts:26:5

# Error details

```
Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-puzzle/enlarged-blank-light-1440.png.
```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e13]:
    - paragraph [ref=e14]: Score at least 20 points in one move.
    - generic [ref=e15]:
      - paragraph [ref=e16]: "CATS: 5 = 5"
      - status [ref=e17]: Scores 5 points.
    - generic [ref=e18]:
      - button "Play word" [ref=e19] [cursor=pointer]:
        - paragraph [ref=e22]: Play word
      - button "Recall tiles" [ref=e23] [cursor=pointer]:
        - paragraph [ref=e26]: Recall tiles
    - group "Your rack" [ref=e27]:
      - button "A, 1 points" [ref=e28] [cursor=pointer]:
        - generic [ref=e29]: A
        - generic [ref=e30]: "1"
      - button "E, 1 points" [ref=e31] [cursor=pointer]:
        - generic [ref=e32]: E
        - generic [ref=e33]: "1"
      - button "S, 1 points" [ref=e34] [cursor=pointer]:
        - generic [ref=e35]: S
        - generic [ref=e36]: "1"
      - button "T, 1 points" [ref=e37] [cursor=pointer]:
        - generic [ref=e38]: T
        - generic [ref=e39]: "1"
      - button "Blank, 0 points, on the board" [disabled] [ref=e40]
      - button "R, 1 points" [ref=e41] [cursor=pointer]:
        - generic [ref=e42]: R
        - generic [ref=e43]: "1"
      - button "N, 1 points" [ref=e44] [cursor=pointer]:
        - generic [ref=e45]: "N"
        - generic [ref=e46]: "1"
    - paragraph [ref=e47]: "j8: 3L triples this letter. Blank tiles score 0."
    - generic [ref=e49]:
      - region "Scrollable word board" [ref=e50]:
        - group "Puzzle board, fifteen columns and fifteen rows" [ref=e51]:
          - generic [ref=e53]: a
          - generic [ref=e54]: b
          - generic [ref=e55]: c
          - generic [ref=e56]: d
          - generic [ref=e57]: e
          - generic [ref=e58]: f
          - generic [ref=e59]: g
          - generic [ref=e60]: h
          - generic [ref=e61]: i
          - generic [ref=e62]: j
          - generic [ref=e63]: k
          - generic [ref=e64]: l
          - generic [ref=e65]: m
          - generic [ref=e66]: "n"
          - generic [ref=e67]: o
          - generic [ref=e68]: "1"
          - button "2L, a1, double letter, empty" [ref=e69] [cursor=pointer]:
            - generic [ref=e70]: 2L
          - button "b1, empty" [ref=e71] [cursor=pointer]
          - button "c1, empty" [ref=e72] [cursor=pointer]
          - button "d1, empty" [ref=e73] [cursor=pointer]
          - button "3W, e1, triple word, empty" [ref=e74] [cursor=pointer]:
            - generic [ref=e75]: 3W
          - button "f1, empty" [ref=e76] [cursor=pointer]
          - button "g1, empty" [ref=e77] [cursor=pointer]
          - button "2L, h1, double letter, empty" [ref=e78] [cursor=pointer]:
            - generic [ref=e79]: 2L
          - button "i1, empty" [ref=e80] [cursor=pointer]
          - button "j1, empty" [ref=e81] [cursor=pointer]
          - button "3W, k1, triple word, empty" [ref=e82] [cursor=pointer]:
            - generic [ref=e83]: 3W
          - button "l1, empty" [ref=e84] [cursor=pointer]
          - button "m1, empty" [ref=e85] [cursor=pointer]
          - button "n1, empty" [ref=e86] [cursor=pointer]
          - button "2L, o1, double letter, empty" [ref=e87] [cursor=pointer]:
            - generic [ref=e88]: 2L
          - generic [ref=e89]: "2"
          - button "a2, empty" [ref=e90] [cursor=pointer]
          - button "b2, empty" [ref=e91] [cursor=pointer]
          - button "c2, empty" [ref=e92] [cursor=pointer]
          - button "2L, d2, double letter, empty" [ref=e93] [cursor=pointer]:
            - generic [ref=e94]: 2L
          - button "e2, empty" [ref=e95] [cursor=pointer]
          - button "f2, empty" [ref=e96] [cursor=pointer]
          - button "2W, g2, double word, empty" [ref=e97] [cursor=pointer]:
            - generic [ref=e98]: 2W
          - button "h2, empty" [ref=e99] [cursor=pointer]
          - button "2W, i2, double word, empty" [ref=e100] [cursor=pointer]:
            - generic [ref=e101]: 2W
          - button "j2, empty" [ref=e102] [cursor=pointer]
          - button "k2, empty" [ref=e103] [cursor=pointer]
          - button "2L, l2, double letter, empty" [ref=e104] [cursor=pointer]:
            - generic [ref=e105]: 2L
          - button "m2, empty" [ref=e106] [cursor=pointer]
          - button "n2, empty" [ref=e107] [cursor=pointer]
          - button "o2, empty" [ref=e108] [cursor=pointer]
          - generic [ref=e109]: "3"
          - button "a3, empty" [ref=e110] [cursor=pointer]
          - button "b3, empty" [ref=e111] [cursor=pointer]
          - button "c3, empty" [ref=e112] [cursor=pointer]
          - button "d3, empty" [ref=e113] [cursor=pointer]
          - button "3L, e3, triple letter, empty" [ref=e114] [cursor=pointer]:
            - generic [ref=e115]: 3L
          - button "f3, empty" [ref=e116] [cursor=pointer]
          - button "g3, empty" [ref=e117] [cursor=pointer]
          - button "h3, empty" [ref=e118] [cursor=pointer]
          - button "i3, empty" [ref=e119] [cursor=pointer]
          - button "j3, empty" [ref=e120] [cursor=pointer]
          - button "3L, k3, triple letter, empty" [ref=e121] [cursor=pointer]:
            - generic [ref=e122]: 3L
          - button "l3, empty" [ref=e123] [cursor=pointer]
          - button "m3, empty" [ref=e124] [cursor=pointer]
          - button "n3, empty" [ref=e125] [cursor=pointer]
          - button "o3, empty" [ref=e126] [cursor=pointer]
          - generic [ref=e127]: "4"
          - button "a4, empty" [ref=e128] [cursor=pointer]
          - button "2L, b4, double letter, empty" [ref=e129] [cursor=pointer]:
            - generic [ref=e130]: 2L
          - button "c4, empty" [ref=e131] [cursor=pointer]
          - button "2W, d4, double word, empty" [ref=e132] [cursor=pointer]:
            - generic [ref=e133]: 2W
          - button "e4, empty" [ref=e134] [cursor=pointer]
          - button "f4, empty" [ref=e135] [cursor=pointer]
          - button "g4, empty" [ref=e136] [cursor=pointer]
          - button "h4, empty" [ref=e137] [cursor=pointer]
          - button "i4, empty" [ref=e138] [cursor=pointer]
          - button "j4, empty" [ref=e139] [cursor=pointer]
          - button "k4, empty" [ref=e140] [cursor=pointer]
          - button "2W, l4, double word, empty" [ref=e141] [cursor=pointer]:
            - generic [ref=e142]: 2W
          - button "m4, empty" [ref=e143] [cursor=pointer]
          - button "2L, n4, double letter, empty" [ref=e144] [cursor=pointer]:
            - generic [ref=e145]: 2L
          - button "o4, empty" [ref=e146] [cursor=pointer]
          - generic [ref=e147]: "5"
          - button "3W, a5, triple word, empty" [ref=e148] [cursor=pointer]:
            - generic [ref=e149]: 3W
          - button "b5, empty" [ref=e150] [cursor=pointer]
          - button "3L, c5, triple letter, empty" [ref=e151] [cursor=pointer]:
            - generic [ref=e152]: 3L
          - button "d5, empty" [ref=e153] [cursor=pointer]
          - button "e5, empty" [ref=e154] [cursor=pointer]
          - button "f5, empty" [ref=e155] [cursor=pointer]
          - button "2L, g5, double letter, empty" [ref=e156] [cursor=pointer]:
            - generic [ref=e157]: 2L
          - button "h5, empty" [ref=e158] [cursor=pointer]
          - button "2L, i5, double letter, empty" [ref=e159] [cursor=pointer]:
            - generic [ref=e160]: 2L
          - button "j5, empty" [ref=e161] [cursor=pointer]
          - button "k5, empty" [ref=e162] [cursor=pointer]
          - button "l5, empty" [ref=e163] [cursor=pointer]
          - button "3L, m5, triple letter, empty" [ref=e164] [cursor=pointer]:
            - generic [ref=e165]: 3L
          - button "n5, empty" [ref=e166] [cursor=pointer]
          - button "3W, o5, triple word, empty" [ref=e167] [cursor=pointer]:
            - generic [ref=e168]: 3W
          - generic [ref=e169]: "6"
          - button "a6, empty" [ref=e170] [cursor=pointer]
          - button "b6, empty" [ref=e171] [cursor=pointer]
          - button "c6, empty" [ref=e172] [cursor=pointer]
          - button "d6, empty" [ref=e173] [cursor=pointer]
          - button "e6, empty" [ref=e174] [cursor=pointer]
          - button "f6, empty" [ref=e175] [cursor=pointer]
          - button "g6, empty" [ref=e176] [cursor=pointer]
          - button "3L, h6, triple letter, empty" [ref=e177] [cursor=pointer]:
            - generic [ref=e178]: 3L
          - button "i6, empty" [ref=e179] [cursor=pointer]
          - button "j6, empty" [ref=e180] [cursor=pointer]
          - button "k6, empty" [ref=e181] [cursor=pointer]
          - button "l6, empty" [ref=e182] [cursor=pointer]
          - button "m6, empty" [ref=e183] [cursor=pointer]
          - button "n6, empty" [ref=e184] [cursor=pointer]
          - button "o6, empty" [ref=e185] [cursor=pointer]
          - generic [ref=e186]: "7"
          - button "a7, empty" [ref=e187] [cursor=pointer]
          - button "2W, b7, double word, empty" [ref=e188] [cursor=pointer]:
            - generic [ref=e189]: 2W
          - button "c7, empty" [ref=e190] [cursor=pointer]
          - button "d7, empty" [ref=e191] [cursor=pointer]
          - button "2L, e7, double letter, empty" [ref=e192] [cursor=pointer]:
            - generic [ref=e193]: 2L
          - button "f7, empty" [ref=e194] [cursor=pointer]
          - button "2L, g7, double letter, empty" [ref=e195] [cursor=pointer]:
            - generic [ref=e196]: 2L
          - button "h7, empty" [ref=e197] [cursor=pointer]
          - button "2L, i7, double letter, empty" [ref=e198] [cursor=pointer]:
            - generic [ref=e199]: 2L
          - button "j7, empty" [ref=e200] [cursor=pointer]
          - button "2L, k7, double letter, empty" [ref=e201] [cursor=pointer]:
            - generic [ref=e202]: 2L
          - button "l7, empty" [ref=e203] [cursor=pointer]
          - button "m7, empty" [ref=e204] [cursor=pointer]
          - button "2W, n7, double word, empty" [ref=e205] [cursor=pointer]:
            - generic [ref=e206]: 2W
          - button "o7, empty" [ref=e207] [cursor=pointer]
          - generic [ref=e208]: "8"
          - button "2L, a8, double letter, empty" [ref=e209] [cursor=pointer]:
            - generic [ref=e210]: 2L
          - button "b8, empty" [ref=e211] [cursor=pointer]
          - button "c8, empty" [ref=e212] [cursor=pointer]
          - button "d8, empty" [ref=e213] [cursor=pointer]
          - button "e8, empty" [ref=e214] [cursor=pointer]
          - button "3L, f8, triple letter, empty" [ref=e215] [cursor=pointer]:
            - generic [ref=e216]: 3L
          - button "C 3, g8, committed" [disabled] [ref=e217]:
            - generic [ref=e218]: C
            - generic [ref=e219]: "3"
          - button "A 1, h8, committed" [disabled] [ref=e220]:
            - generic [ref=e221]: A
            - generic [ref=e222]: "1"
          - button "T 1, i8, committed" [disabled] [ref=e223]:
            - generic [ref=e224]: T
            - generic [ref=e225]: "1"
          - button "S 0, j8, your tentative blank as S" [ref=e226] [cursor=pointer]:
            - generic [ref=e227]: S
            - generic [ref=e228]: "0"
          - button "k8, empty" [ref=e229] [cursor=pointer]
          - button "l8, empty" [ref=e230] [cursor=pointer]
          - button "m8, empty" [ref=e231] [cursor=pointer]
          - button "n8, empty" [ref=e232] [cursor=pointer]
          - button "2L, o8, double letter, empty" [ref=e233] [cursor=pointer]:
            - generic [ref=e234]: 2L
          - generic [ref=e235]: "9"
          - button "a9, empty" [ref=e236] [cursor=pointer]
          - button "2W, b9, double word, empty" [ref=e237] [cursor=pointer]:
            - generic [ref=e238]: 2W
          - button "c9, empty" [ref=e239] [cursor=pointer]
          - button "d9, empty" [ref=e240] [cursor=pointer]
          - button "2L, e9, double letter, empty" [ref=e241] [cursor=pointer]:
            - generic [ref=e242]: 2L
          - button "f9, empty" [ref=e243] [cursor=pointer]
          - button "2L, g9, double letter, empty" [ref=e244] [cursor=pointer]:
            - generic [ref=e245]: 2L
          - button "h9, empty" [ref=e246] [cursor=pointer]
          - button "O 1, i9, committed" [disabled] [ref=e247]:
            - generic [ref=e248]: O
            - generic [ref=e249]: "1"
          - button "j9, empty" [ref=e250] [cursor=pointer]
          - button "2L, k9, double letter, empty" [ref=e251] [cursor=pointer]:
            - generic [ref=e252]: 2L
          - button "l9, empty" [ref=e253] [cursor=pointer]
          - button "m9, empty" [ref=e254] [cursor=pointer]
          - button "2W, n9, double word, empty" [ref=e255] [cursor=pointer]:
            - generic [ref=e256]: 2W
          - button "o9, empty" [ref=e257] [cursor=pointer]
          - generic [ref=e258]: "10"
          - button "a10, empty" [ref=e259] [cursor=pointer]
          - button "b10, empty" [ref=e260] [cursor=pointer]
          - button "c10, empty" [ref=e261] [cursor=pointer]
          - button "d10, empty" [ref=e262] [cursor=pointer]
          - button "e10, empty" [ref=e263] [cursor=pointer]
          - button "f10, empty" [ref=e264] [cursor=pointer]
          - button "g10, empty" [ref=e265] [cursor=pointer]
          - button "3L, h10, triple letter, empty" [ref=e266] [cursor=pointer]:
            - generic [ref=e267]: 3L
          - button "E 1, i10, committed" [disabled] [ref=e268]:
            - generic [ref=e269]: E
            - generic [ref=e270]: "1"
          - button "j10, empty" [ref=e271] [cursor=pointer]
          - button "k10, empty" [ref=e272] [cursor=pointer]
          - button "l10, empty" [ref=e273] [cursor=pointer]
          - button "m10, empty" [ref=e274] [cursor=pointer]
          - button "n10, empty" [ref=e275] [cursor=pointer]
          - button "o10, empty" [ref=e276] [cursor=pointer]
          - generic [ref=e277]: "11"
          - button "3W, a11, triple word, empty" [ref=e278] [cursor=pointer]:
            - generic [ref=e279]: 3W
          - button "b11, empty" [ref=e280] [cursor=pointer]
          - button "3L, c11, triple letter, empty" [ref=e281] [cursor=pointer]:
            - generic [ref=e282]: 3L
          - button "d11, empty" [ref=e283] [cursor=pointer]
          - button "e11, empty" [ref=e284] [cursor=pointer]
          - button "f11, empty" [ref=e285] [cursor=pointer]
          - button "2L, g11, double letter, empty" [ref=e286] [cursor=pointer]:
            - generic [ref=e287]: 2L
          - button "h11, empty" [ref=e288] [cursor=pointer]
          - button "2L, i11, double letter, empty" [ref=e289] [cursor=pointer]:
            - generic [ref=e290]: 2L
          - button "j11, empty" [ref=e291] [cursor=pointer]
          - button "k11, empty" [ref=e292] [cursor=pointer]
          - button "l11, empty" [ref=e293] [cursor=pointer]
          - button "3L, m11, triple letter, empty" [ref=e294] [cursor=pointer]:
            - generic [ref=e295]: 3L
          - button "n11, empty" [ref=e296] [cursor=pointer]
          - button "3W, o11, triple word, empty" [ref=e297] [cursor=pointer]:
            - generic [ref=e298]: 3W
          - generic [ref=e299]: "12"
          - button "a12, empty" [ref=e300] [cursor=pointer]
          - button "2L, b12, double letter, empty" [ref=e301] [cursor=pointer]:
            - generic [ref=e302]: 2L
          - button "c12, empty" [ref=e303] [cursor=pointer]
          - button "2W, d12, double word, empty" [ref=e304] [cursor=pointer]:
            - generic [ref=e305]: 2W
          - button "e12, empty" [ref=e306] [cursor=pointer]
          - button "f12, empty" [ref=e307] [cursor=pointer]
          - button "g12, empty" [ref=e308] [cursor=pointer]
          - button "h12, empty" [ref=e309] [cursor=pointer]
          - button "i12, empty" [ref=e310] [cursor=pointer]
          - button "j12, empty" [ref=e311] [cursor=pointer]
          - button "k12, empty" [ref=e312] [cursor=pointer]
          - button "2W, l12, double word, empty" [ref=e313] [cursor=pointer]:
            - generic [ref=e314]: 2W
          - button "m12, empty" [ref=e315] [cursor=pointer]
          - button "2L, n12, double letter, empty" [ref=e316] [cursor=pointer]:
            - generic [ref=e317]: 2L
          - button "o12, empty" [ref=e318] [cursor=pointer]
          - generic [ref=e319]: "13"
          - button "a13, empty" [ref=e320] [cursor=pointer]
          - button "b13, empty" [ref=e321] [cursor=pointer]
          - button "c13, empty" [ref=e322] [cursor=pointer]
          - button "d13, empty" [ref=e323] [cursor=pointer]
          - button "3L, e13, triple letter, empty" [ref=e324] [cursor=pointer]:
            - generic [ref=e325]: 3L
          - button "f13, empty" [ref=e326] [cursor=pointer]
          - button "g13, empty" [ref=e327] [cursor=pointer]
          - button "h13, empty" [ref=e328] [cursor=pointer]
          - button "i13, empty" [ref=e329] [cursor=pointer]
          - button "j13, empty" [ref=e330] [cursor=pointer]
          - button "3L, k13, triple letter, empty" [ref=e331] [cursor=pointer]:
            - generic [ref=e332]: 3L
          - button "l13, empty" [ref=e333] [cursor=pointer]
          - button "m13, empty" [ref=e334] [cursor=pointer]
          - button "n13, empty" [ref=e335] [cursor=pointer]
          - button "o13, empty" [ref=e336] [cursor=pointer]
          - generic [ref=e337]: "14"
          - button "a14, empty" [ref=e338] [cursor=pointer]
          - button "b14, empty" [ref=e339] [cursor=pointer]
          - button "c14, empty" [ref=e340] [cursor=pointer]
          - button "2L, d14, double letter, empty" [ref=e341] [cursor=pointer]:
            - generic [ref=e342]: 2L
          - button "e14, empty" [ref=e343] [cursor=pointer]
          - button "f14, empty" [ref=e344] [cursor=pointer]
          - button "2W, g14, double word, empty" [ref=e345] [cursor=pointer]:
            - generic [ref=e346]: 2W
          - button "h14, empty" [ref=e347] [cursor=pointer]
          - button "2W, i14, double word, empty" [ref=e348] [cursor=pointer]:
            - generic [ref=e349]: 2W
          - button "j14, empty" [ref=e350] [cursor=pointer]
          - button "k14, empty" [ref=e351] [cursor=pointer]
          - button "2L, l14, double letter, empty" [ref=e352] [cursor=pointer]:
            - generic [ref=e353]: 2L
          - button "m14, empty" [ref=e354] [cursor=pointer]
          - button "n14, empty" [ref=e355] [cursor=pointer]
          - button "o14, empty" [ref=e356] [cursor=pointer]
          - generic [ref=e357]: "15"
          - button "2L, a15, double letter, empty" [ref=e358] [cursor=pointer]:
            - generic [ref=e359]: 2L
          - button "b15, empty" [ref=e360] [cursor=pointer]
          - button "c15, empty" [ref=e361] [cursor=pointer]
          - button "d15, empty" [ref=e362] [cursor=pointer]
          - button "3W, e15, triple word, empty" [ref=e363] [cursor=pointer]:
            - generic [ref=e364]: 3W
          - button "f15, empty" [ref=e365] [cursor=pointer]
          - button "g15, empty" [ref=e366] [cursor=pointer]
          - button "2L, h15, double letter, empty" [ref=e367] [cursor=pointer]:
            - generic [ref=e368]: 2L
          - button "i15, empty" [ref=e369] [cursor=pointer]
          - button "j15, empty" [ref=e370] [cursor=pointer]
          - button "3W, k15, triple word, empty" [ref=e371] [cursor=pointer]:
            - generic [ref=e372]: 3W
          - button "l15, empty" [ref=e373] [cursor=pointer]
          - button "m15, empty" [ref=e374] [cursor=pointer]
          - button "n15, empty" [ref=e375] [cursor=pointer]
          - button "2L, o15, double letter, empty" [ref=e376] [cursor=pointer]:
            - generic [ref=e377]: 2L
      - generic [ref=e378]:
        - generic [ref=e379]:
          - img "Whole board overview; outline shows the enlarged area" [ref=e380]
          - group "View a board region" [ref=e607]:
            - button "View a1 to e5" [ref=e608] [cursor=pointer]
            - button "View f1 to j5" [ref=e609] [cursor=pointer]
            - button "View k1 to o5" [ref=e610] [cursor=pointer]
            - button "View a6 to e10" [ref=e611] [cursor=pointer]
            - button "View f6 to j10" [ref=e612] [cursor=pointer]
            - button "View k6 to o10" [ref=e613] [cursor=pointer]
            - button "View a11 to e15" [ref=e614] [cursor=pointer]
            - button "View f11 to j15" [ref=e615] [cursor=pointer]
            - button "View k11 to o15" [ref=e616] [cursor=pointer]
        - generic [ref=e617]:
          - generic [ref=e618]:
            - button "Fit board" [ref=e619] [cursor=pointer]:
              - paragraph [ref=e622]: Fit board
            - button "Enlarge board" [pressed] [ref=e623] [cursor=pointer]:
              - paragraph [ref=e626]: Enlarge board
          - paragraph [ref=e627]: A 1, h8, committed
          - 'button "Board map: locate a square" [active] [ref=e628] [cursor=pointer]': Map
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
     |                                                 ^ Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-puzzle/enlarged-blank-light-1440.png.
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```