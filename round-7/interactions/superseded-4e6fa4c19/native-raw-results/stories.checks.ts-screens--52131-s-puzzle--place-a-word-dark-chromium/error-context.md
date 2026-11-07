# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-puzzle--place-a-word dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  65387 pixels (ratio 0.20 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-puzzle/place-a-word-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-puzzle/place-a-word-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 65387 pixels (ratio 0.20 of all image pixels) are different.
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
  - 65387 pixels (ratio 0.20 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e10]:
    - paragraph [ref=e11]: Score at least 20 points in one move.
    - alert [ref=e12]:
      - img [ref=e15]
      - generic [ref=e17]:
        - paragraph [ref=e18]: "Not in the word list: TOEEA"
        - paragraph [ref=e19]: Recall tiles to try another word. Your rack is kept.
    - generic [ref=e20]:
      - button "Play word" [disabled] [ref=e21]:
        - paragraph [ref=e24]: Play word
      - button "Recall tiles" [ref=e25] [cursor=pointer]:
        - paragraph [ref=e28]: Recall tiles
    - group "Your rack" [ref=e29]:
      - button "A, 1 points, on the board" [disabled] [ref=e30]
      - button "E, 1 points, on the board" [disabled] [ref=e31]
      - button "S, 1 points" [ref=e32] [cursor=pointer]:
        - generic [ref=e33]: S
        - generic [ref=e34]: "1"
      - button "T, 1 points" [ref=e35] [cursor=pointer]:
        - generic [ref=e36]: T
        - generic [ref=e37]: "1"
      - button "Blank, 0 points" [ref=e38] [cursor=pointer]:
        - generic [ref=e39]: "0"
      - button "R, 1 points" [ref=e40] [cursor=pointer]:
        - generic [ref=e41]: R
        - generic [ref=e42]: "1"
      - button "N, 1 points" [ref=e43] [cursor=pointer]:
        - generic [ref=e44]: "N"
        - generic [ref=e45]: "1"
    - paragraph [ref=e46]: "i12: No bonus on this square."
    - generic [ref=e48]:
      - region "Scrollable word board" [ref=e49]:
        - group "Puzzle board, fifteen columns and fifteen rows" [ref=e50]:
          - generic [ref=e52]: a
          - generic [ref=e53]: b
          - generic [ref=e54]: c
          - generic [ref=e55]: d
          - generic [ref=e56]: e
          - generic [ref=e57]: f
          - generic [ref=e58]: g
          - generic [ref=e59]: h
          - generic [ref=e60]: i
          - generic [ref=e61]: j
          - generic [ref=e62]: k
          - generic [ref=e63]: l
          - generic [ref=e64]: m
          - generic [ref=e65]: "n"
          - generic [ref=e66]: o
          - generic [ref=e67]: "1"
          - button "2L, a1, double letter, empty" [ref=e68] [cursor=pointer]:
            - generic [ref=e69]: 2L
          - button "b1, empty" [ref=e70] [cursor=pointer]
          - button "c1, empty" [ref=e71] [cursor=pointer]
          - button "d1, empty" [ref=e72] [cursor=pointer]
          - button "3W, e1, triple word, empty" [ref=e73] [cursor=pointer]:
            - generic [ref=e74]: 3W
          - button "f1, empty" [ref=e75] [cursor=pointer]
          - button "g1, empty" [ref=e76] [cursor=pointer]
          - button "2L, h1, double letter, empty" [ref=e77] [cursor=pointer]:
            - generic [ref=e78]: 2L
          - button "i1, empty" [ref=e79] [cursor=pointer]
          - button "j1, empty" [ref=e80] [cursor=pointer]
          - button "3W, k1, triple word, empty" [ref=e81] [cursor=pointer]:
            - generic [ref=e82]: 3W
          - button "l1, empty" [ref=e83] [cursor=pointer]
          - button "m1, empty" [ref=e84] [cursor=pointer]
          - button "n1, empty" [ref=e85] [cursor=pointer]
          - button "2L, o1, double letter, empty" [ref=e86] [cursor=pointer]:
            - generic [ref=e87]: 2L
          - generic [ref=e88]: "2"
          - button "a2, empty" [ref=e89] [cursor=pointer]
          - button "b2, empty" [ref=e90] [cursor=pointer]
          - button "c2, empty" [ref=e91] [cursor=pointer]
          - button "2L, d2, double letter, empty" [ref=e92] [cursor=pointer]:
            - generic [ref=e93]: 2L
          - button "e2, empty" [ref=e94] [cursor=pointer]
          - button "f2, empty" [ref=e95] [cursor=pointer]
          - button "2W, g2, double word, empty" [ref=e96] [cursor=pointer]:
            - generic [ref=e97]: 2W
          - button "h2, empty" [ref=e98] [cursor=pointer]
          - button "2W, i2, double word, empty" [ref=e99] [cursor=pointer]:
            - generic [ref=e100]: 2W
          - button "j2, empty" [ref=e101] [cursor=pointer]
          - button "k2, empty" [ref=e102] [cursor=pointer]
          - button "2L, l2, double letter, empty" [ref=e103] [cursor=pointer]:
            - generic [ref=e104]: 2L
          - button "m2, empty" [ref=e105] [cursor=pointer]
          - button "n2, empty" [ref=e106] [cursor=pointer]
          - button "o2, empty" [ref=e107] [cursor=pointer]
          - generic [ref=e108]: "3"
          - button "a3, empty" [ref=e109] [cursor=pointer]
          - button "b3, empty" [ref=e110] [cursor=pointer]
          - button "c3, empty" [ref=e111] [cursor=pointer]
          - button "d3, empty" [ref=e112] [cursor=pointer]
          - button "3L, e3, triple letter, empty" [ref=e113] [cursor=pointer]:
            - generic [ref=e114]: 3L
          - button "f3, empty" [ref=e115] [cursor=pointer]
          - button "g3, empty" [ref=e116] [cursor=pointer]
          - button "h3, empty" [ref=e117] [cursor=pointer]
          - button "i3, empty" [ref=e118] [cursor=pointer]
          - button "j3, empty" [ref=e119] [cursor=pointer]
          - button "3L, k3, triple letter, empty" [ref=e120] [cursor=pointer]:
            - generic [ref=e121]: 3L
          - button "l3, empty" [ref=e122] [cursor=pointer]
          - button "m3, empty" [ref=e123] [cursor=pointer]
          - button "n3, empty" [ref=e124] [cursor=pointer]
          - button "o3, empty" [ref=e125] [cursor=pointer]
          - generic [ref=e126]: "4"
          - button "a4, empty" [ref=e127] [cursor=pointer]
          - button "2L, b4, double letter, empty" [ref=e128] [cursor=pointer]:
            - generic [ref=e129]: 2L
          - button "c4, empty" [ref=e130] [cursor=pointer]
          - button "2W, d4, double word, empty" [ref=e131] [cursor=pointer]:
            - generic [ref=e132]: 2W
          - button "e4, empty" [ref=e133] [cursor=pointer]
          - button "f4, empty" [ref=e134] [cursor=pointer]
          - button "g4, empty" [ref=e135] [cursor=pointer]
          - button "h4, empty" [ref=e136] [cursor=pointer]
          - button "i4, empty" [ref=e137] [cursor=pointer]
          - button "j4, empty" [ref=e138] [cursor=pointer]
          - button "k4, empty" [ref=e139] [cursor=pointer]
          - button "2W, l4, double word, empty" [ref=e140] [cursor=pointer]:
            - generic [ref=e141]: 2W
          - button "m4, empty" [ref=e142] [cursor=pointer]
          - button "2L, n4, double letter, empty" [ref=e143] [cursor=pointer]:
            - generic [ref=e144]: 2L
          - button "o4, empty" [ref=e145] [cursor=pointer]
          - generic [ref=e146]: "5"
          - button "3W, a5, triple word, empty" [ref=e147] [cursor=pointer]:
            - generic [ref=e148]: 3W
          - button "b5, empty" [ref=e149] [cursor=pointer]
          - button "3L, c5, triple letter, empty" [ref=e150] [cursor=pointer]:
            - generic [ref=e151]: 3L
          - button "d5, empty" [ref=e152] [cursor=pointer]
          - button "e5, empty" [ref=e153] [cursor=pointer]
          - button "f5, empty" [ref=e154] [cursor=pointer]
          - button "2L, g5, double letter, empty" [ref=e155] [cursor=pointer]:
            - generic [ref=e156]: 2L
          - button "h5, empty" [ref=e157] [cursor=pointer]
          - button "2L, i5, double letter, empty" [ref=e158] [cursor=pointer]:
            - generic [ref=e159]: 2L
          - button "j5, empty" [ref=e160] [cursor=pointer]
          - button "k5, empty" [ref=e161] [cursor=pointer]
          - button "l5, empty" [ref=e162] [cursor=pointer]
          - button "3L, m5, triple letter, empty" [ref=e163] [cursor=pointer]:
            - generic [ref=e164]: 3L
          - button "n5, empty" [ref=e165] [cursor=pointer]
          - button "3W, o5, triple word, empty" [ref=e166] [cursor=pointer]:
            - generic [ref=e167]: 3W
          - generic [ref=e168]: "6"
          - button "a6, empty" [ref=e169] [cursor=pointer]
          - button "b6, empty" [ref=e170] [cursor=pointer]
          - button "c6, empty" [ref=e171] [cursor=pointer]
          - button "d6, empty" [ref=e172] [cursor=pointer]
          - button "e6, empty" [ref=e173] [cursor=pointer]
          - button "f6, empty" [ref=e174] [cursor=pointer]
          - button "g6, empty" [ref=e175] [cursor=pointer]
          - button "3L, h6, triple letter, empty" [ref=e176] [cursor=pointer]:
            - generic [ref=e177]: 3L
          - button "i6, empty" [ref=e178] [cursor=pointer]
          - button "j6, empty" [ref=e179] [cursor=pointer]
          - button "k6, empty" [ref=e180] [cursor=pointer]
          - button "l6, empty" [ref=e181] [cursor=pointer]
          - button "m6, empty" [ref=e182] [cursor=pointer]
          - button "n6, empty" [ref=e183] [cursor=pointer]
          - button "o6, empty" [ref=e184] [cursor=pointer]
          - generic [ref=e185]: "7"
          - button "a7, empty" [ref=e186] [cursor=pointer]
          - button "2W, b7, double word, empty" [ref=e187] [cursor=pointer]:
            - generic [ref=e188]: 2W
          - button "c7, empty" [ref=e189] [cursor=pointer]
          - button "d7, empty" [ref=e190] [cursor=pointer]
          - button "2L, e7, double letter, empty" [ref=e191] [cursor=pointer]:
            - generic [ref=e192]: 2L
          - button "f7, empty" [ref=e193] [cursor=pointer]
          - button "2L, g7, double letter, empty" [ref=e194] [cursor=pointer]:
            - generic [ref=e195]: 2L
          - button "h7, empty" [ref=e196] [cursor=pointer]
          - button "2L, i7, double letter, empty" [ref=e197] [cursor=pointer]:
            - generic [ref=e198]: 2L
          - button "j7, empty" [ref=e199] [cursor=pointer]
          - button "2L, k7, double letter, empty" [ref=e200] [cursor=pointer]:
            - generic [ref=e201]: 2L
          - button "l7, empty" [ref=e202] [cursor=pointer]
          - button "m7, empty" [ref=e203] [cursor=pointer]
          - button "2W, n7, double word, empty" [ref=e204] [cursor=pointer]:
            - generic [ref=e205]: 2W
          - button "o7, empty" [ref=e206] [cursor=pointer]
          - generic [ref=e207]: "8"
          - button "2L, a8, double letter, empty" [ref=e208] [cursor=pointer]:
            - generic [ref=e209]: 2L
          - button "b8, empty" [ref=e210] [cursor=pointer]
          - button "c8, empty" [ref=e211] [cursor=pointer]
          - button "d8, empty" [ref=e212] [cursor=pointer]
          - button "e8, empty" [ref=e213] [cursor=pointer]
          - button "3L, f8, triple letter, empty" [ref=e214] [cursor=pointer]:
            - generic [ref=e215]: 3L
          - button "C 3, g8, committed" [disabled] [ref=e216]:
            - generic [ref=e217]: C
            - generic [ref=e218]: "3"
          - button "A 1, h8, committed" [disabled] [ref=e219]:
            - generic [ref=e220]: A
            - generic [ref=e221]: "1"
          - button "T 1, i8, committed" [disabled] [ref=e222]:
            - generic [ref=e223]: T
            - generic [ref=e224]: "1"
          - button "3L, j8, triple letter, empty" [ref=e225] [cursor=pointer]:
            - generic [ref=e226]: 3L
          - button "k8, empty" [ref=e227] [cursor=pointer]
          - button "l8, empty" [ref=e228] [cursor=pointer]
          - button "m8, empty" [ref=e229] [cursor=pointer]
          - button "n8, empty" [ref=e230] [cursor=pointer]
          - button "2L, o8, double letter, empty" [ref=e231] [cursor=pointer]:
            - generic [ref=e232]: 2L
          - generic [ref=e233]: "9"
          - button "a9, empty" [ref=e234] [cursor=pointer]
          - button "2W, b9, double word, empty" [ref=e235] [cursor=pointer]:
            - generic [ref=e236]: 2W
          - button "c9, empty" [ref=e237] [cursor=pointer]
          - button "d9, empty" [ref=e238] [cursor=pointer]
          - button "2L, e9, double letter, empty" [ref=e239] [cursor=pointer]:
            - generic [ref=e240]: 2L
          - button "f9, empty" [ref=e241] [cursor=pointer]
          - button "2L, g9, double letter, empty" [ref=e242] [cursor=pointer]:
            - generic [ref=e243]: 2L
          - button "h9, empty" [ref=e244] [cursor=pointer]
          - button "O 1, i9, committed" [disabled] [ref=e245]:
            - generic [ref=e246]: O
            - generic [ref=e247]: "1"
          - button "j9, empty" [ref=e248] [cursor=pointer]
          - button "2L, k9, double letter, empty" [ref=e249] [cursor=pointer]:
            - generic [ref=e250]: 2L
          - button "l9, empty" [ref=e251] [cursor=pointer]
          - button "m9, empty" [ref=e252] [cursor=pointer]
          - button "2W, n9, double word, empty" [ref=e253] [cursor=pointer]:
            - generic [ref=e254]: 2W
          - button "o9, empty" [ref=e255] [cursor=pointer]
          - generic [ref=e256]: "10"
          - button "a10, empty" [ref=e257] [cursor=pointer]
          - button "b10, empty" [ref=e258] [cursor=pointer]
          - button "c10, empty" [ref=e259] [cursor=pointer]
          - button "d10, empty" [ref=e260] [cursor=pointer]
          - button "e10, empty" [ref=e261] [cursor=pointer]
          - button "f10, empty" [ref=e262] [cursor=pointer]
          - button "g10, empty" [ref=e263] [cursor=pointer]
          - button "3L, h10, triple letter, empty" [ref=e264] [cursor=pointer]:
            - generic [ref=e265]: 3L
          - button "E 1, i10, committed" [disabled] [ref=e266]:
            - generic [ref=e267]: E
            - generic [ref=e268]: "1"
          - button "j10, empty" [ref=e269] [cursor=pointer]
          - button "k10, empty" [ref=e270] [cursor=pointer]
          - button "l10, empty" [ref=e271] [cursor=pointer]
          - button "m10, empty" [ref=e272] [cursor=pointer]
          - button "n10, empty" [ref=e273] [cursor=pointer]
          - button "o10, empty" [ref=e274] [cursor=pointer]
          - generic [ref=e275]: "11"
          - button "3W, a11, triple word, empty" [ref=e276] [cursor=pointer]:
            - generic [ref=e277]: 3W
          - button "b11, empty" [ref=e278] [cursor=pointer]
          - button "3L, c11, triple letter, empty" [ref=e279] [cursor=pointer]:
            - generic [ref=e280]: 3L
          - button "d11, empty" [ref=e281] [cursor=pointer]
          - button "e11, empty" [ref=e282] [cursor=pointer]
          - button "f11, empty" [ref=e283] [cursor=pointer]
          - button "2L, g11, double letter, empty" [ref=e284] [cursor=pointer]:
            - generic [ref=e285]: 2L
          - button "h11, empty" [ref=e286] [cursor=pointer]
          - button "E 1, i11, your tentative tile" [ref=e287] [cursor=pointer]:
            - generic [ref=e288]: E
            - generic [ref=e289]: "1"
          - button "j11, empty" [ref=e290] [cursor=pointer]
          - button "k11, empty" [ref=e291] [cursor=pointer]
          - button "l11, empty" [ref=e292] [cursor=pointer]
          - button "3L, m11, triple letter, empty" [ref=e293] [cursor=pointer]:
            - generic [ref=e294]: 3L
          - button "n11, empty" [ref=e295] [cursor=pointer]
          - button "3W, o11, triple word, empty" [ref=e296] [cursor=pointer]:
            - generic [ref=e297]: 3W
          - generic [ref=e298]: "12"
          - button "a12, empty" [ref=e299] [cursor=pointer]
          - button "2L, b12, double letter, empty" [ref=e300] [cursor=pointer]:
            - generic [ref=e301]: 2L
          - button "c12, empty" [ref=e302] [cursor=pointer]
          - button "2W, d12, double word, empty" [ref=e303] [cursor=pointer]:
            - generic [ref=e304]: 2W
          - button "e12, empty" [ref=e305] [cursor=pointer]
          - button "f12, empty" [ref=e306] [cursor=pointer]
          - button "g12, empty" [ref=e307] [cursor=pointer]
          - button "h12, empty" [ref=e308] [cursor=pointer]
          - button "A 1, i12, your tentative tile" [active] [ref=e309] [cursor=pointer]:
            - generic [ref=e310]: A
            - generic [ref=e311]: "1"
          - button "j12, empty" [ref=e312] [cursor=pointer]
          - button "k12, empty" [ref=e313] [cursor=pointer]
          - button "2W, l12, double word, empty" [ref=e314] [cursor=pointer]:
            - generic [ref=e315]: 2W
          - button "m12, empty" [ref=e316] [cursor=pointer]
          - button "2L, n12, double letter, empty" [ref=e317] [cursor=pointer]:
            - generic [ref=e318]: 2L
          - button "o12, empty" [ref=e319] [cursor=pointer]
          - generic [ref=e320]: "13"
          - button "a13, empty" [ref=e321] [cursor=pointer]
          - button "b13, empty" [ref=e322] [cursor=pointer]
          - button "c13, empty" [ref=e323] [cursor=pointer]
          - button "d13, empty" [ref=e324] [cursor=pointer]
          - button "3L, e13, triple letter, empty" [ref=e325] [cursor=pointer]:
            - generic [ref=e326]: 3L
          - button "f13, empty" [ref=e327] [cursor=pointer]
          - button "g13, empty" [ref=e328] [cursor=pointer]
          - button "h13, empty" [ref=e329] [cursor=pointer]
          - button "i13, empty" [ref=e330] [cursor=pointer]
          - button "j13, empty" [ref=e331] [cursor=pointer]
          - button "3L, k13, triple letter, empty" [ref=e332] [cursor=pointer]:
            - generic [ref=e333]: 3L
          - button "l13, empty" [ref=e334] [cursor=pointer]
          - button "m13, empty" [ref=e335] [cursor=pointer]
          - button "n13, empty" [ref=e336] [cursor=pointer]
          - button "o13, empty" [ref=e337] [cursor=pointer]
          - generic [ref=e338]: "14"
          - button "a14, empty" [ref=e339] [cursor=pointer]
          - button "b14, empty" [ref=e340] [cursor=pointer]
          - button "c14, empty" [ref=e341] [cursor=pointer]
          - button "2L, d14, double letter, empty" [ref=e342] [cursor=pointer]:
            - generic [ref=e343]: 2L
          - button "e14, empty" [ref=e344] [cursor=pointer]
          - button "f14, empty" [ref=e345] [cursor=pointer]
          - button "2W, g14, double word, empty" [ref=e346] [cursor=pointer]:
            - generic [ref=e347]: 2W
          - button "h14, empty" [ref=e348] [cursor=pointer]
          - button "2W, i14, double word, empty" [ref=e349] [cursor=pointer]:
            - generic [ref=e350]: 2W
          - button "j14, empty" [ref=e351] [cursor=pointer]
          - button "k14, empty" [ref=e352] [cursor=pointer]
          - button "2L, l14, double letter, empty" [ref=e353] [cursor=pointer]:
            - generic [ref=e354]: 2L
          - button "m14, empty" [ref=e355] [cursor=pointer]
          - button "n14, empty" [ref=e356] [cursor=pointer]
          - button "o14, empty" [ref=e357] [cursor=pointer]
          - generic [ref=e358]: "15"
          - button "2L, a15, double letter, empty" [ref=e359] [cursor=pointer]:
            - generic [ref=e360]: 2L
          - button "b15, empty" [ref=e361] [cursor=pointer]
          - button "c15, empty" [ref=e362] [cursor=pointer]
          - button "d15, empty" [ref=e363] [cursor=pointer]
          - button "3W, e15, triple word, empty" [ref=e364] [cursor=pointer]:
            - generic [ref=e365]: 3W
          - button "f15, empty" [ref=e366] [cursor=pointer]
          - button "g15, empty" [ref=e367] [cursor=pointer]
          - button "2L, h15, double letter, empty" [ref=e368] [cursor=pointer]:
            - generic [ref=e369]: 2L
          - button "i15, empty" [ref=e370] [cursor=pointer]
          - button "j15, empty" [ref=e371] [cursor=pointer]
          - button "3W, k15, triple word, empty" [ref=e372] [cursor=pointer]:
            - generic [ref=e373]: 3W
          - button "l15, empty" [ref=e374] [cursor=pointer]
          - button "m15, empty" [ref=e375] [cursor=pointer]
          - button "n15, empty" [ref=e376] [cursor=pointer]
          - button "2L, o15, double letter, empty" [ref=e377] [cursor=pointer]:
            - generic [ref=e378]: 2L
      - generic [ref=e379]:
        - generic [ref=e380]:
          - img "Whole board overview; outline shows the enlarged area" [ref=e381]
          - group "View a board region" [ref=e608]:
            - button "View a1 to e5" [ref=e609] [cursor=pointer]
            - button "View f1 to j5" [ref=e610] [cursor=pointer]
            - button "View k1 to o5" [ref=e611] [cursor=pointer]
            - button "View a6 to e10" [ref=e612] [cursor=pointer]
            - button "View f6 to j10" [ref=e613] [cursor=pointer]
            - button "View k6 to o10" [ref=e614] [cursor=pointer]
            - button "View a11 to e15" [ref=e615] [cursor=pointer]
            - button "View f11 to j15" [ref=e616] [cursor=pointer]
            - button "View k11 to o15" [ref=e617] [cursor=pointer]
        - generic [ref=e618]:
          - generic [ref=e619]:
            - button "Fit board" [ref=e620] [cursor=pointer]:
              - paragraph [ref=e623]: Fit board
            - button "Enlarge board" [pressed] [ref=e624] [cursor=pointer]:
              - paragraph [ref=e627]: Enlarge board
          - paragraph [ref=e628]: A 1, i12, your tentative tile
          - 'button "Board map: locate a square" [ref=e629] [cursor=pointer]': Map
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