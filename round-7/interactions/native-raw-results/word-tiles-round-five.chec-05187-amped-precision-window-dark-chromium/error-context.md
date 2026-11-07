# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: word-tiles-round-five.checks.ts >> screens-games-word-tiles-puzzle--enlarged-blank regression word-tiles-cramped-precision-window dark
- Location: tests/storybook/word-tiles-round-five.checks.ts:26:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  77411 pixels (ratio 0.24 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-puzzle/enlarged-blank-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-puzzle/enlarged-blank-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 77411 pixels (ratio 0.24 of all image pixels) are different.
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
  - 77411 pixels (ratio 0.24 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e10]:
    - paragraph [ref=e11]: Score at least 20 points in one move.
    - generic [ref=e12]:
      - paragraph [ref=e13]: "CATS: 5 = 5"
      - status [ref=e14]: Scores 5 points.
    - generic [ref=e15]:
      - button "Play word" [ref=e16] [cursor=pointer]:
        - paragraph [ref=e19]: Play word
      - button "Recall tiles" [ref=e20] [cursor=pointer]:
        - paragraph [ref=e23]: Recall tiles
    - group "Your rack" [ref=e24]:
      - button "A, 1 points" [ref=e25] [cursor=pointer]:
        - generic [ref=e26]: A
        - generic [ref=e27]: "1"
      - button "E, 1 points" [ref=e28] [cursor=pointer]:
        - generic [ref=e29]: E
        - generic [ref=e30]: "1"
      - button "S, 1 points" [ref=e31] [cursor=pointer]:
        - generic [ref=e32]: S
        - generic [ref=e33]: "1"
      - button "T, 1 points" [ref=e34] [cursor=pointer]:
        - generic [ref=e35]: T
        - generic [ref=e36]: "1"
      - button "Blank, 0 points, on the board" [disabled] [ref=e37]
      - button "R, 1 points" [ref=e38] [cursor=pointer]:
        - generic [ref=e39]: R
        - generic [ref=e40]: "1"
      - button "N, 1 points" [ref=e41] [cursor=pointer]:
        - generic [ref=e42]: "N"
        - generic [ref=e43]: "1"
    - paragraph [ref=e44]: "j8: 3L triples this letter. Blank tiles score 0."
    - generic [ref=e46]:
      - region "Scrollable word board" [ref=e47]:
        - group "Puzzle board, fifteen columns and fifteen rows" [ref=e48]:
          - generic [ref=e50]: a
          - generic [ref=e51]: b
          - generic [ref=e52]: c
          - generic [ref=e53]: d
          - generic [ref=e54]: e
          - generic [ref=e55]: f
          - generic [ref=e56]: g
          - generic [ref=e57]: h
          - generic [ref=e58]: i
          - generic [ref=e59]: j
          - generic [ref=e60]: k
          - generic [ref=e61]: l
          - generic [ref=e62]: m
          - generic [ref=e63]: "n"
          - generic [ref=e64]: o
          - generic [ref=e65]: "1"
          - button "2L, a1, double letter, empty" [ref=e66] [cursor=pointer]:
            - generic [ref=e67]: 2L
          - button "b1, empty" [ref=e68] [cursor=pointer]
          - button "c1, empty" [ref=e69] [cursor=pointer]
          - button "d1, empty" [ref=e70] [cursor=pointer]
          - button "3W, e1, triple word, empty" [ref=e71] [cursor=pointer]:
            - generic [ref=e72]: 3W
          - button "f1, empty" [ref=e73] [cursor=pointer]
          - button "g1, empty" [ref=e74] [cursor=pointer]
          - button "2L, h1, double letter, empty" [ref=e75] [cursor=pointer]:
            - generic [ref=e76]: 2L
          - button "i1, empty" [ref=e77] [cursor=pointer]
          - button "j1, empty" [ref=e78] [cursor=pointer]
          - button "3W, k1, triple word, empty" [ref=e79] [cursor=pointer]:
            - generic [ref=e80]: 3W
          - button "l1, empty" [ref=e81] [cursor=pointer]
          - button "m1, empty" [ref=e82] [cursor=pointer]
          - button "n1, empty" [ref=e83] [cursor=pointer]
          - button "2L, o1, double letter, empty" [ref=e84] [cursor=pointer]:
            - generic [ref=e85]: 2L
          - generic [ref=e86]: "2"
          - button "a2, empty" [ref=e87] [cursor=pointer]
          - button "b2, empty" [ref=e88] [cursor=pointer]
          - button "c2, empty" [ref=e89] [cursor=pointer]
          - button "2L, d2, double letter, empty" [ref=e90] [cursor=pointer]:
            - generic [ref=e91]: 2L
          - button "e2, empty" [ref=e92] [cursor=pointer]
          - button "f2, empty" [ref=e93] [cursor=pointer]
          - button "2W, g2, double word, empty" [ref=e94] [cursor=pointer]:
            - generic [ref=e95]: 2W
          - button "h2, empty" [ref=e96] [cursor=pointer]
          - button "2W, i2, double word, empty" [ref=e97] [cursor=pointer]:
            - generic [ref=e98]: 2W
          - button "j2, empty" [ref=e99] [cursor=pointer]
          - button "k2, empty" [ref=e100] [cursor=pointer]
          - button "2L, l2, double letter, empty" [ref=e101] [cursor=pointer]:
            - generic [ref=e102]: 2L
          - button "m2, empty" [ref=e103] [cursor=pointer]
          - button "n2, empty" [ref=e104] [cursor=pointer]
          - button "o2, empty" [ref=e105] [cursor=pointer]
          - generic [ref=e106]: "3"
          - button "a3, empty" [ref=e107] [cursor=pointer]
          - button "b3, empty" [ref=e108] [cursor=pointer]
          - button "c3, empty" [ref=e109] [cursor=pointer]
          - button "d3, empty" [ref=e110] [cursor=pointer]
          - button "3L, e3, triple letter, empty" [ref=e111] [cursor=pointer]:
            - generic [ref=e112]: 3L
          - button "f3, empty" [ref=e113] [cursor=pointer]
          - button "g3, empty" [ref=e114] [cursor=pointer]
          - button "h3, empty" [ref=e115] [cursor=pointer]
          - button "i3, empty" [ref=e116] [cursor=pointer]
          - button "j3, empty" [ref=e117] [cursor=pointer]
          - button "3L, k3, triple letter, empty" [ref=e118] [cursor=pointer]:
            - generic [ref=e119]: 3L
          - button "l3, empty" [ref=e120] [cursor=pointer]
          - button "m3, empty" [ref=e121] [cursor=pointer]
          - button "n3, empty" [ref=e122] [cursor=pointer]
          - button "o3, empty" [ref=e123] [cursor=pointer]
          - generic [ref=e124]: "4"
          - button "a4, empty" [ref=e125] [cursor=pointer]
          - button "2L, b4, double letter, empty" [ref=e126] [cursor=pointer]:
            - generic [ref=e127]: 2L
          - button "c4, empty" [ref=e128] [cursor=pointer]
          - button "2W, d4, double word, empty" [ref=e129] [cursor=pointer]:
            - generic [ref=e130]: 2W
          - button "e4, empty" [ref=e131] [cursor=pointer]
          - button "f4, empty" [ref=e132] [cursor=pointer]
          - button "g4, empty" [ref=e133] [cursor=pointer]
          - button "h4, empty" [ref=e134] [cursor=pointer]
          - button "i4, empty" [ref=e135] [cursor=pointer]
          - button "j4, empty" [ref=e136] [cursor=pointer]
          - button "k4, empty" [ref=e137] [cursor=pointer]
          - button "2W, l4, double word, empty" [ref=e138] [cursor=pointer]:
            - generic [ref=e139]: 2W
          - button "m4, empty" [ref=e140] [cursor=pointer]
          - button "2L, n4, double letter, empty" [ref=e141] [cursor=pointer]:
            - generic [ref=e142]: 2L
          - button "o4, empty" [ref=e143] [cursor=pointer]
          - generic [ref=e144]: "5"
          - button "3W, a5, triple word, empty" [ref=e145] [cursor=pointer]:
            - generic [ref=e146]: 3W
          - button "b5, empty" [ref=e147] [cursor=pointer]
          - button "3L, c5, triple letter, empty" [ref=e148] [cursor=pointer]:
            - generic [ref=e149]: 3L
          - button "d5, empty" [ref=e150] [cursor=pointer]
          - button "e5, empty" [ref=e151] [cursor=pointer]
          - button "f5, empty" [ref=e152] [cursor=pointer]
          - button "2L, g5, double letter, empty" [ref=e153] [cursor=pointer]:
            - generic [ref=e154]: 2L
          - button "h5, empty" [ref=e155] [cursor=pointer]
          - button "2L, i5, double letter, empty" [ref=e156] [cursor=pointer]:
            - generic [ref=e157]: 2L
          - button "j5, empty" [ref=e158] [cursor=pointer]
          - button "k5, empty" [ref=e159] [cursor=pointer]
          - button "l5, empty" [ref=e160] [cursor=pointer]
          - button "3L, m5, triple letter, empty" [ref=e161] [cursor=pointer]:
            - generic [ref=e162]: 3L
          - button "n5, empty" [ref=e163] [cursor=pointer]
          - button "3W, o5, triple word, empty" [ref=e164] [cursor=pointer]:
            - generic [ref=e165]: 3W
          - generic [ref=e166]: "6"
          - button "a6, empty" [ref=e167] [cursor=pointer]
          - button "b6, empty" [ref=e168] [cursor=pointer]
          - button "c6, empty" [ref=e169] [cursor=pointer]
          - button "d6, empty" [ref=e170] [cursor=pointer]
          - button "e6, empty" [ref=e171] [cursor=pointer]
          - button "f6, empty" [ref=e172] [cursor=pointer]
          - button "g6, empty" [ref=e173] [cursor=pointer]
          - button "3L, h6, triple letter, empty" [ref=e174] [cursor=pointer]:
            - generic [ref=e175]: 3L
          - button "i6, empty" [ref=e176] [cursor=pointer]
          - button "j6, empty" [ref=e177] [cursor=pointer]
          - button "k6, empty" [ref=e178] [cursor=pointer]
          - button "l6, empty" [ref=e179] [cursor=pointer]
          - button "m6, empty" [ref=e180] [cursor=pointer]
          - button "n6, empty" [ref=e181] [cursor=pointer]
          - button "o6, empty" [ref=e182] [cursor=pointer]
          - generic [ref=e183]: "7"
          - button "a7, empty" [ref=e184] [cursor=pointer]
          - button "2W, b7, double word, empty" [ref=e185] [cursor=pointer]:
            - generic [ref=e186]: 2W
          - button "c7, empty" [ref=e187] [cursor=pointer]
          - button "d7, empty" [ref=e188] [cursor=pointer]
          - button "2L, e7, double letter, empty" [ref=e189] [cursor=pointer]:
            - generic [ref=e190]: 2L
          - button "f7, empty" [ref=e191] [cursor=pointer]
          - button "2L, g7, double letter, empty" [ref=e192] [cursor=pointer]:
            - generic [ref=e193]: 2L
          - button "h7, empty" [ref=e194] [cursor=pointer]
          - button "2L, i7, double letter, empty" [ref=e195] [cursor=pointer]:
            - generic [ref=e196]: 2L
          - button "j7, empty" [ref=e197] [cursor=pointer]
          - button "2L, k7, double letter, empty" [ref=e198] [cursor=pointer]:
            - generic [ref=e199]: 2L
          - button "l7, empty" [ref=e200] [cursor=pointer]
          - button "m7, empty" [ref=e201] [cursor=pointer]
          - button "2W, n7, double word, empty" [ref=e202] [cursor=pointer]:
            - generic [ref=e203]: 2W
          - button "o7, empty" [ref=e204] [cursor=pointer]
          - generic [ref=e205]: "8"
          - button "2L, a8, double letter, empty" [ref=e206] [cursor=pointer]:
            - generic [ref=e207]: 2L
          - button "b8, empty" [ref=e208] [cursor=pointer]
          - button "c8, empty" [ref=e209] [cursor=pointer]
          - button "d8, empty" [ref=e210] [cursor=pointer]
          - button "e8, empty" [ref=e211] [cursor=pointer]
          - button "3L, f8, triple letter, empty" [ref=e212] [cursor=pointer]:
            - generic [ref=e213]: 3L
          - button "C 3, g8, committed" [disabled] [ref=e214]:
            - generic [ref=e215]: C
            - generic [ref=e216]: "3"
          - button "A 1, h8, committed" [disabled] [ref=e217]:
            - generic [ref=e218]: A
            - generic [ref=e219]: "1"
          - button "T 1, i8, committed" [disabled] [ref=e220]:
            - generic [ref=e221]: T
            - generic [ref=e222]: "1"
          - button "S 0, j8, your tentative blank as S" [ref=e223] [cursor=pointer]:
            - generic [ref=e224]: S
            - generic [ref=e225]: "0"
          - button "k8, empty" [ref=e226] [cursor=pointer]
          - button "l8, empty" [ref=e227] [cursor=pointer]
          - button "m8, empty" [ref=e228] [cursor=pointer]
          - button "n8, empty" [ref=e229] [cursor=pointer]
          - button "2L, o8, double letter, empty" [ref=e230] [cursor=pointer]:
            - generic [ref=e231]: 2L
          - generic [ref=e232]: "9"
          - button "a9, empty" [ref=e233] [cursor=pointer]
          - button "2W, b9, double word, empty" [ref=e234] [cursor=pointer]:
            - generic [ref=e235]: 2W
          - button "c9, empty" [ref=e236] [cursor=pointer]
          - button "d9, empty" [ref=e237] [cursor=pointer]
          - button "2L, e9, double letter, empty" [ref=e238] [cursor=pointer]:
            - generic [ref=e239]: 2L
          - button "f9, empty" [ref=e240] [cursor=pointer]
          - button "2L, g9, double letter, empty" [ref=e241] [cursor=pointer]:
            - generic [ref=e242]: 2L
          - button "h9, empty" [ref=e243] [cursor=pointer]
          - button "O 1, i9, committed" [disabled] [ref=e244]:
            - generic [ref=e245]: O
            - generic [ref=e246]: "1"
          - button "j9, empty" [ref=e247] [cursor=pointer]
          - button "2L, k9, double letter, empty" [ref=e248] [cursor=pointer]:
            - generic [ref=e249]: 2L
          - button "l9, empty" [ref=e250] [cursor=pointer]
          - button "m9, empty" [ref=e251] [cursor=pointer]
          - button "2W, n9, double word, empty" [ref=e252] [cursor=pointer]:
            - generic [ref=e253]: 2W
          - button "o9, empty" [ref=e254] [cursor=pointer]
          - generic [ref=e255]: "10"
          - button "a10, empty" [ref=e256] [cursor=pointer]
          - button "b10, empty" [ref=e257] [cursor=pointer]
          - button "c10, empty" [ref=e258] [cursor=pointer]
          - button "d10, empty" [ref=e259] [cursor=pointer]
          - button "e10, empty" [ref=e260] [cursor=pointer]
          - button "f10, empty" [ref=e261] [cursor=pointer]
          - button "g10, empty" [ref=e262] [cursor=pointer]
          - button "3L, h10, triple letter, empty" [ref=e263] [cursor=pointer]:
            - generic [ref=e264]: 3L
          - button "E 1, i10, committed" [disabled] [ref=e265]:
            - generic [ref=e266]: E
            - generic [ref=e267]: "1"
          - button "j10, empty" [ref=e268] [cursor=pointer]
          - button "k10, empty" [ref=e269] [cursor=pointer]
          - button "l10, empty" [ref=e270] [cursor=pointer]
          - button "m10, empty" [ref=e271] [cursor=pointer]
          - button "n10, empty" [ref=e272] [cursor=pointer]
          - button "o10, empty" [ref=e273] [cursor=pointer]
          - generic [ref=e274]: "11"
          - button "3W, a11, triple word, empty" [ref=e275] [cursor=pointer]:
            - generic [ref=e276]: 3W
          - button "b11, empty" [ref=e277] [cursor=pointer]
          - button "3L, c11, triple letter, empty" [ref=e278] [cursor=pointer]:
            - generic [ref=e279]: 3L
          - button "d11, empty" [ref=e280] [cursor=pointer]
          - button "e11, empty" [ref=e281] [cursor=pointer]
          - button "f11, empty" [ref=e282] [cursor=pointer]
          - button "2L, g11, double letter, empty" [ref=e283] [cursor=pointer]:
            - generic [ref=e284]: 2L
          - button "h11, empty" [ref=e285] [cursor=pointer]
          - button "2L, i11, double letter, empty" [ref=e286] [cursor=pointer]:
            - generic [ref=e287]: 2L
          - button "j11, empty" [ref=e288] [cursor=pointer]
          - button "k11, empty" [ref=e289] [cursor=pointer]
          - button "l11, empty" [ref=e290] [cursor=pointer]
          - button "3L, m11, triple letter, empty" [ref=e291] [cursor=pointer]:
            - generic [ref=e292]: 3L
          - button "n11, empty" [ref=e293] [cursor=pointer]
          - button "3W, o11, triple word, empty" [ref=e294] [cursor=pointer]:
            - generic [ref=e295]: 3W
          - generic [ref=e296]: "12"
          - button "a12, empty" [ref=e297] [cursor=pointer]
          - button "2L, b12, double letter, empty" [ref=e298] [cursor=pointer]:
            - generic [ref=e299]: 2L
          - button "c12, empty" [ref=e300] [cursor=pointer]
          - button "2W, d12, double word, empty" [ref=e301] [cursor=pointer]:
            - generic [ref=e302]: 2W
          - button "e12, empty" [ref=e303] [cursor=pointer]
          - button "f12, empty" [ref=e304] [cursor=pointer]
          - button "g12, empty" [ref=e305] [cursor=pointer]
          - button "h12, empty" [ref=e306] [cursor=pointer]
          - button "i12, empty" [ref=e307] [cursor=pointer]
          - button "j12, empty" [ref=e308] [cursor=pointer]
          - button "k12, empty" [ref=e309] [cursor=pointer]
          - button "2W, l12, double word, empty" [ref=e310] [cursor=pointer]:
            - generic [ref=e311]: 2W
          - button "m12, empty" [ref=e312] [cursor=pointer]
          - button "2L, n12, double letter, empty" [ref=e313] [cursor=pointer]:
            - generic [ref=e314]: 2L
          - button "o12, empty" [ref=e315] [cursor=pointer]
          - generic [ref=e316]: "13"
          - button "a13, empty" [ref=e317] [cursor=pointer]
          - button "b13, empty" [ref=e318] [cursor=pointer]
          - button "c13, empty" [ref=e319] [cursor=pointer]
          - button "d13, empty" [ref=e320] [cursor=pointer]
          - button "3L, e13, triple letter, empty" [ref=e321] [cursor=pointer]:
            - generic [ref=e322]: 3L
          - button "f13, empty" [ref=e323] [cursor=pointer]
          - button "g13, empty" [ref=e324] [cursor=pointer]
          - button "h13, empty" [ref=e325] [cursor=pointer]
          - button "i13, empty" [ref=e326] [cursor=pointer]
          - button "j13, empty" [ref=e327] [cursor=pointer]
          - button "3L, k13, triple letter, empty" [ref=e328] [cursor=pointer]:
            - generic [ref=e329]: 3L
          - button "l13, empty" [ref=e330] [cursor=pointer]
          - button "m13, empty" [ref=e331] [cursor=pointer]
          - button "n13, empty" [ref=e332] [cursor=pointer]
          - button "o13, empty" [ref=e333] [cursor=pointer]
          - generic [ref=e334]: "14"
          - button "a14, empty" [ref=e335] [cursor=pointer]
          - button "b14, empty" [ref=e336] [cursor=pointer]
          - button "c14, empty" [ref=e337] [cursor=pointer]
          - button "2L, d14, double letter, empty" [ref=e338] [cursor=pointer]:
            - generic [ref=e339]: 2L
          - button "e14, empty" [ref=e340] [cursor=pointer]
          - button "f14, empty" [ref=e341] [cursor=pointer]
          - button "2W, g14, double word, empty" [ref=e342] [cursor=pointer]:
            - generic [ref=e343]: 2W
          - button "h14, empty" [ref=e344] [cursor=pointer]
          - button "2W, i14, double word, empty" [ref=e345] [cursor=pointer]:
            - generic [ref=e346]: 2W
          - button "j14, empty" [ref=e347] [cursor=pointer]
          - button "k14, empty" [ref=e348] [cursor=pointer]
          - button "2L, l14, double letter, empty" [ref=e349] [cursor=pointer]:
            - generic [ref=e350]: 2L
          - button "m14, empty" [ref=e351] [cursor=pointer]
          - button "n14, empty" [ref=e352] [cursor=pointer]
          - button "o14, empty" [ref=e353] [cursor=pointer]
          - generic [ref=e354]: "15"
          - button "2L, a15, double letter, empty" [ref=e355] [cursor=pointer]:
            - generic [ref=e356]: 2L
          - button "b15, empty" [ref=e357] [cursor=pointer]
          - button "c15, empty" [ref=e358] [cursor=pointer]
          - button "d15, empty" [ref=e359] [cursor=pointer]
          - button "3W, e15, triple word, empty" [ref=e360] [cursor=pointer]:
            - generic [ref=e361]: 3W
          - button "f15, empty" [ref=e362] [cursor=pointer]
          - button "g15, empty" [ref=e363] [cursor=pointer]
          - button "2L, h15, double letter, empty" [ref=e364] [cursor=pointer]:
            - generic [ref=e365]: 2L
          - button "i15, empty" [ref=e366] [cursor=pointer]
          - button "j15, empty" [ref=e367] [cursor=pointer]
          - button "3W, k15, triple word, empty" [ref=e368] [cursor=pointer]:
            - generic [ref=e369]: 3W
          - button "l15, empty" [ref=e370] [cursor=pointer]
          - button "m15, empty" [ref=e371] [cursor=pointer]
          - button "n15, empty" [ref=e372] [cursor=pointer]
          - button "2L, o15, double letter, empty" [ref=e373] [cursor=pointer]:
            - generic [ref=e374]: 2L
      - generic [ref=e375]:
        - generic [ref=e376]:
          - img "Whole board overview; outline shows the enlarged area" [ref=e377]
          - group "View a board region" [ref=e604]:
            - button "View a1 to e5" [ref=e605] [cursor=pointer]
            - button "View f1 to j5" [ref=e606] [cursor=pointer]
            - button "View k1 to o5" [ref=e607] [cursor=pointer]
            - button "View a6 to e10" [ref=e608] [cursor=pointer]
            - button "View f6 to j10" [ref=e609] [cursor=pointer]
            - button "View k6 to o10" [ref=e610] [cursor=pointer]
            - button "View a11 to e15" [ref=e611] [cursor=pointer]
            - button "View f11 to j15" [ref=e612] [cursor=pointer]
            - button "View k11 to o15" [ref=e613] [cursor=pointer]
        - generic [ref=e614]:
          - generic [ref=e615]:
            - button "Fit board" [ref=e616] [cursor=pointer]:
              - paragraph [ref=e619]: Fit board
            - button "Enlarge board" [pressed] [ref=e620] [cursor=pointer]:
              - paragraph [ref=e623]: Enlarge board
          - paragraph [ref=e624]: A 1, h8, committed
          - 'button "Board map: locate a square" [active] [ref=e625] [cursor=pointer]': Map
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