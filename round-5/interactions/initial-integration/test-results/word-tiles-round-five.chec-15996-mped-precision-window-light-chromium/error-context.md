# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: word-tiles-round-five.checks.ts >> screens-games-word-tiles-puzzle--enlarged-blank regression word-tiles-cramped-precision-window light
- Location: tests/storybook/word-tiles-round-five.checks.ts:26:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  81131 pixels (ratio 0.25 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-puzzle/enlarged-blank-light.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-puzzle/enlarged-blank-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 81131 pixels (ratio 0.25 of all image pixels) are different.
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
  - 81131 pixels (ratio 0.25 of all image pixels) are different.

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
    - generic [ref=e45]:
      - generic [ref=e46]:
        - button "Fit board" [ref=e47] [cursor=pointer]:
          - paragraph [ref=e50]: Fit board
        - button "Enlarge board" [pressed] [ref=e51] [cursor=pointer]:
          - paragraph [ref=e54]: Enlarge board
      - paragraph [ref=e55]: Scroll to explore. Arrow keys move between squares; Enter places your selected tile.
      - generic [ref=e56]:
        - region "Scrollable word board" [ref=e57]:
          - group "Puzzle board, fifteen columns and fifteen rows" [ref=e58]:
            - generic [ref=e60]: a
            - generic [ref=e61]: b
            - generic [ref=e62]: c
            - generic [ref=e63]: d
            - generic [ref=e64]: e
            - generic [ref=e65]: f
            - generic [ref=e66]: g
            - generic [ref=e67]: h
            - generic [ref=e68]: i
            - generic [ref=e69]: j
            - generic [ref=e70]: k
            - generic [ref=e71]: l
            - generic [ref=e72]: m
            - generic [ref=e73]: "n"
            - generic [ref=e74]: o
            - generic [ref=e75]: "1"
            - button "2L, a1, double letter, empty" [ref=e76] [cursor=pointer]:
              - generic [ref=e77]: 2L
            - button "b1, empty" [ref=e78] [cursor=pointer]
            - button "c1, empty" [ref=e79] [cursor=pointer]
            - button "d1, empty" [ref=e80] [cursor=pointer]
            - button "3W, e1, triple word, empty" [ref=e81] [cursor=pointer]:
              - generic [ref=e82]: 3W
            - button "f1, empty" [ref=e83] [cursor=pointer]
            - button "g1, empty" [ref=e84] [cursor=pointer]
            - button "2L, h1, double letter, empty" [ref=e85] [cursor=pointer]:
              - generic [ref=e86]: 2L
            - button "i1, empty" [ref=e87] [cursor=pointer]
            - button "j1, empty" [ref=e88] [cursor=pointer]
            - button "3W, k1, triple word, empty" [ref=e89] [cursor=pointer]:
              - generic [ref=e90]: 3W
            - button "l1, empty" [ref=e91] [cursor=pointer]
            - button "m1, empty" [ref=e92] [cursor=pointer]
            - button "n1, empty" [ref=e93] [cursor=pointer]
            - button "2L, o1, double letter, empty" [ref=e94] [cursor=pointer]:
              - generic [ref=e95]: 2L
            - generic [ref=e96]: "2"
            - button "a2, empty" [ref=e97] [cursor=pointer]
            - button "b2, empty" [ref=e98] [cursor=pointer]
            - button "c2, empty" [ref=e99] [cursor=pointer]
            - button "2L, d2, double letter, empty" [ref=e100] [cursor=pointer]:
              - generic [ref=e101]: 2L
            - button "e2, empty" [ref=e102] [cursor=pointer]
            - button "f2, empty" [ref=e103] [cursor=pointer]
            - button "2W, g2, double word, empty" [ref=e104] [cursor=pointer]:
              - generic [ref=e105]: 2W
            - button "h2, empty" [ref=e106] [cursor=pointer]
            - button "2W, i2, double word, empty" [ref=e107] [cursor=pointer]:
              - generic [ref=e108]: 2W
            - button "j2, empty" [ref=e109] [cursor=pointer]
            - button "k2, empty" [ref=e110] [cursor=pointer]
            - button "2L, l2, double letter, empty" [ref=e111] [cursor=pointer]:
              - generic [ref=e112]: 2L
            - button "m2, empty" [ref=e113] [cursor=pointer]
            - button "n2, empty" [ref=e114] [cursor=pointer]
            - button "o2, empty" [ref=e115] [cursor=pointer]
            - generic [ref=e116]: "3"
            - button "a3, empty" [ref=e117] [cursor=pointer]
            - button "b3, empty" [ref=e118] [cursor=pointer]
            - button "c3, empty" [ref=e119] [cursor=pointer]
            - button "d3, empty" [ref=e120] [cursor=pointer]
            - button "3L, e3, triple letter, empty" [ref=e121] [cursor=pointer]:
              - generic [ref=e122]: 3L
            - button "f3, empty" [ref=e123] [cursor=pointer]
            - button "g3, empty" [ref=e124] [cursor=pointer]
            - button "h3, empty" [ref=e125] [cursor=pointer]
            - button "i3, empty" [ref=e126] [cursor=pointer]
            - button "j3, empty" [ref=e127] [cursor=pointer]
            - button "3L, k3, triple letter, empty" [ref=e128] [cursor=pointer]:
              - generic [ref=e129]: 3L
            - button "l3, empty" [ref=e130] [cursor=pointer]
            - button "m3, empty" [ref=e131] [cursor=pointer]
            - button "n3, empty" [ref=e132] [cursor=pointer]
            - button "o3, empty" [ref=e133] [cursor=pointer]
            - generic [ref=e134]: "4"
            - button "a4, empty" [ref=e135] [cursor=pointer]
            - button "2L, b4, double letter, empty" [ref=e136] [cursor=pointer]:
              - generic [ref=e137]: 2L
            - button "c4, empty" [ref=e138] [cursor=pointer]
            - button "2W, d4, double word, empty" [ref=e139] [cursor=pointer]:
              - generic [ref=e140]: 2W
            - button "e4, empty" [ref=e141] [cursor=pointer]
            - button "f4, empty" [ref=e142] [cursor=pointer]
            - button "g4, empty" [ref=e143] [cursor=pointer]
            - button "h4, empty" [ref=e144] [cursor=pointer]
            - button "i4, empty" [ref=e145] [cursor=pointer]
            - button "j4, empty" [ref=e146] [cursor=pointer]
            - button "k4, empty" [ref=e147] [cursor=pointer]
            - button "2W, l4, double word, empty" [ref=e148] [cursor=pointer]:
              - generic [ref=e149]: 2W
            - button "m4, empty" [ref=e150] [cursor=pointer]
            - button "2L, n4, double letter, empty" [ref=e151] [cursor=pointer]:
              - generic [ref=e152]: 2L
            - button "o4, empty" [ref=e153] [cursor=pointer]
            - generic [ref=e154]: "5"
            - button "3W, a5, triple word, empty" [ref=e155] [cursor=pointer]:
              - generic [ref=e156]: 3W
            - button "b5, empty" [ref=e157] [cursor=pointer]
            - button "3L, c5, triple letter, empty" [ref=e158] [cursor=pointer]:
              - generic [ref=e159]: 3L
            - button "d5, empty" [ref=e160] [cursor=pointer]
            - button "e5, empty" [ref=e161] [cursor=pointer]
            - button "f5, empty" [ref=e162] [cursor=pointer]
            - button "2L, g5, double letter, empty" [ref=e163] [cursor=pointer]:
              - generic [ref=e164]: 2L
            - button "h5, empty" [ref=e165] [cursor=pointer]
            - button "2L, i5, double letter, empty" [ref=e166] [cursor=pointer]:
              - generic [ref=e167]: 2L
            - button "j5, empty" [ref=e168] [cursor=pointer]
            - button "k5, empty" [ref=e169] [cursor=pointer]
            - button "l5, empty" [ref=e170] [cursor=pointer]
            - button "3L, m5, triple letter, empty" [ref=e171] [cursor=pointer]:
              - generic [ref=e172]: 3L
            - button "n5, empty" [ref=e173] [cursor=pointer]
            - button "3W, o5, triple word, empty" [ref=e174] [cursor=pointer]:
              - generic [ref=e175]: 3W
            - generic [ref=e176]: "6"
            - button "a6, empty" [ref=e177] [cursor=pointer]
            - button "b6, empty" [ref=e178] [cursor=pointer]
            - button "c6, empty" [ref=e179] [cursor=pointer]
            - button "d6, empty" [ref=e180] [cursor=pointer]
            - button "e6, empty" [ref=e181] [cursor=pointer]
            - button "f6, empty" [ref=e182] [cursor=pointer]
            - button "g6, empty" [ref=e183] [cursor=pointer]
            - button "3L, h6, triple letter, empty" [ref=e184] [cursor=pointer]:
              - generic [ref=e185]: 3L
            - button "i6, empty" [ref=e186] [cursor=pointer]
            - button "j6, empty" [ref=e187] [cursor=pointer]
            - button "k6, empty" [ref=e188] [cursor=pointer]
            - button "l6, empty" [ref=e189] [cursor=pointer]
            - button "m6, empty" [ref=e190] [cursor=pointer]
            - button "n6, empty" [ref=e191] [cursor=pointer]
            - button "o6, empty" [ref=e192] [cursor=pointer]
            - generic [ref=e193]: "7"
            - button "a7, empty" [ref=e194] [cursor=pointer]
            - button "2W, b7, double word, empty" [ref=e195] [cursor=pointer]:
              - generic [ref=e196]: 2W
            - button "c7, empty" [ref=e197] [cursor=pointer]
            - button "d7, empty" [ref=e198] [cursor=pointer]
            - button "2L, e7, double letter, empty" [ref=e199] [cursor=pointer]:
              - generic [ref=e200]: 2L
            - button "f7, empty" [ref=e201] [cursor=pointer]
            - button "2L, g7, double letter, empty" [ref=e202] [cursor=pointer]:
              - generic [ref=e203]: 2L
            - button "h7, empty" [ref=e204] [cursor=pointer]
            - button "2L, i7, double letter, empty" [ref=e205] [cursor=pointer]:
              - generic [ref=e206]: 2L
            - button "j7, empty" [ref=e207] [cursor=pointer]
            - button "2L, k7, double letter, empty" [ref=e208] [cursor=pointer]:
              - generic [ref=e209]: 2L
            - button "l7, empty" [ref=e210] [cursor=pointer]
            - button "m7, empty" [ref=e211] [cursor=pointer]
            - button "2W, n7, double word, empty" [ref=e212] [cursor=pointer]:
              - generic [ref=e213]: 2W
            - button "o7, empty" [ref=e214] [cursor=pointer]
            - generic [ref=e215]: "8"
            - button "2L, a8, double letter, empty" [ref=e216] [cursor=pointer]:
              - generic [ref=e217]: 2L
            - button "b8, empty" [ref=e218] [cursor=pointer]
            - button "c8, empty" [ref=e219] [cursor=pointer]
            - button "d8, empty" [ref=e220] [cursor=pointer]
            - button "e8, empty" [ref=e221] [cursor=pointer]
            - button "3L, f8, triple letter, empty" [ref=e222] [cursor=pointer]:
              - generic [ref=e223]: 3L
            - button "C 3, g8, committed" [disabled] [ref=e224]:
              - generic [ref=e225]: C
              - generic [ref=e226]: "3"
            - button "A 1, h8, committed" [disabled] [ref=e227]:
              - generic [ref=e228]: A
              - generic [ref=e229]: "1"
            - button "T 1, i8, committed" [disabled] [ref=e230]:
              - generic [ref=e231]: T
              - generic [ref=e232]: "1"
            - button "S 0, j8, your tentative blank as S" [ref=e233] [cursor=pointer]:
              - generic [ref=e234]: S
              - generic [ref=e235]: "0"
            - button "k8, empty" [ref=e236] [cursor=pointer]
            - button "l8, empty" [ref=e237] [cursor=pointer]
            - button "m8, empty" [ref=e238] [cursor=pointer]
            - button "n8, empty" [ref=e239] [cursor=pointer]
            - button "2L, o8, double letter, empty" [ref=e240] [cursor=pointer]:
              - generic [ref=e241]: 2L
            - generic [ref=e242]: "9"
            - button "a9, empty" [ref=e243] [cursor=pointer]
            - button "2W, b9, double word, empty" [ref=e244] [cursor=pointer]:
              - generic [ref=e245]: 2W
            - button "c9, empty" [ref=e246] [cursor=pointer]
            - button "d9, empty" [ref=e247] [cursor=pointer]
            - button "2L, e9, double letter, empty" [ref=e248] [cursor=pointer]:
              - generic [ref=e249]: 2L
            - button "f9, empty" [ref=e250] [cursor=pointer]
            - button "2L, g9, double letter, empty" [ref=e251] [cursor=pointer]:
              - generic [ref=e252]: 2L
            - button "h9, empty" [ref=e253] [cursor=pointer]
            - button "O 1, i9, committed" [disabled] [ref=e254]:
              - generic [ref=e255]: O
              - generic [ref=e256]: "1"
            - button "j9, empty" [ref=e257] [cursor=pointer]
            - button "2L, k9, double letter, empty" [ref=e258] [cursor=pointer]:
              - generic [ref=e259]: 2L
            - button "l9, empty" [ref=e260] [cursor=pointer]
            - button "m9, empty" [ref=e261] [cursor=pointer]
            - button "2W, n9, double word, empty" [ref=e262] [cursor=pointer]:
              - generic [ref=e263]: 2W
            - button "o9, empty" [ref=e264] [cursor=pointer]
            - generic [ref=e265]: "10"
            - button "a10, empty" [ref=e266] [cursor=pointer]
            - button "b10, empty" [ref=e267] [cursor=pointer]
            - button "c10, empty" [ref=e268] [cursor=pointer]
            - button "d10, empty" [ref=e269] [cursor=pointer]
            - button "e10, empty" [ref=e270] [cursor=pointer]
            - button "f10, empty" [ref=e271] [cursor=pointer]
            - button "g10, empty" [ref=e272] [cursor=pointer]
            - button "3L, h10, triple letter, empty" [ref=e273] [cursor=pointer]:
              - generic [ref=e274]: 3L
            - button "E 1, i10, committed" [disabled] [ref=e275]:
              - generic [ref=e276]: E
              - generic [ref=e277]: "1"
            - button "j10, empty" [ref=e278] [cursor=pointer]
            - button "k10, empty" [ref=e279] [cursor=pointer]
            - button "l10, empty" [ref=e280] [cursor=pointer]
            - button "m10, empty" [ref=e281] [cursor=pointer]
            - button "n10, empty" [ref=e282] [cursor=pointer]
            - button "o10, empty" [ref=e283] [cursor=pointer]
            - generic [ref=e284]: "11"
            - button "3W, a11, triple word, empty" [ref=e285] [cursor=pointer]:
              - generic [ref=e286]: 3W
            - button "b11, empty" [ref=e287] [cursor=pointer]
            - button "3L, c11, triple letter, empty" [ref=e288] [cursor=pointer]:
              - generic [ref=e289]: 3L
            - button "d11, empty" [ref=e290] [cursor=pointer]
            - button "e11, empty" [ref=e291] [cursor=pointer]
            - button "f11, empty" [ref=e292] [cursor=pointer]
            - button "2L, g11, double letter, empty" [ref=e293] [cursor=pointer]:
              - generic [ref=e294]: 2L
            - button "h11, empty" [ref=e295] [cursor=pointer]
            - button "2L, i11, double letter, empty" [ref=e296] [cursor=pointer]:
              - generic [ref=e297]: 2L
            - button "j11, empty" [ref=e298] [cursor=pointer]
            - button "k11, empty" [ref=e299] [cursor=pointer]
            - button "l11, empty" [ref=e300] [cursor=pointer]
            - button "3L, m11, triple letter, empty" [ref=e301] [cursor=pointer]:
              - generic [ref=e302]: 3L
            - button "n11, empty" [ref=e303] [cursor=pointer]
            - button "3W, o11, triple word, empty" [ref=e304] [cursor=pointer]:
              - generic [ref=e305]: 3W
            - generic [ref=e306]: "12"
            - button "a12, empty" [ref=e307] [cursor=pointer]
            - button "2L, b12, double letter, empty" [ref=e308] [cursor=pointer]:
              - generic [ref=e309]: 2L
            - button "c12, empty" [ref=e310] [cursor=pointer]
            - button "2W, d12, double word, empty" [ref=e311] [cursor=pointer]:
              - generic [ref=e312]: 2W
            - button "e12, empty" [ref=e313] [cursor=pointer]
            - button "f12, empty" [ref=e314] [cursor=pointer]
            - button "g12, empty" [ref=e315] [cursor=pointer]
            - button "h12, empty" [ref=e316] [cursor=pointer]
            - button "i12, empty" [ref=e317] [cursor=pointer]
            - button "j12, empty" [ref=e318] [cursor=pointer]
            - button "k12, empty" [ref=e319] [cursor=pointer]
            - button "2W, l12, double word, empty" [ref=e320] [cursor=pointer]:
              - generic [ref=e321]: 2W
            - button "m12, empty" [ref=e322] [cursor=pointer]
            - button "2L, n12, double letter, empty" [ref=e323] [cursor=pointer]:
              - generic [ref=e324]: 2L
            - button "o12, empty" [ref=e325] [cursor=pointer]
            - generic [ref=e326]: "13"
            - button "a13, empty" [ref=e327] [cursor=pointer]
            - button "b13, empty" [ref=e328] [cursor=pointer]
            - button "c13, empty" [ref=e329] [cursor=pointer]
            - button "d13, empty" [ref=e330] [cursor=pointer]
            - button "3L, e13, triple letter, empty" [ref=e331] [cursor=pointer]:
              - generic [ref=e332]: 3L
            - button "f13, empty" [ref=e333] [cursor=pointer]
            - button "g13, empty" [ref=e334] [cursor=pointer]
            - button "h13, empty" [ref=e335] [cursor=pointer]
            - button "i13, empty" [ref=e336] [cursor=pointer]
            - button "j13, empty" [ref=e337] [cursor=pointer]
            - button "3L, k13, triple letter, empty" [ref=e338] [cursor=pointer]:
              - generic [ref=e339]: 3L
            - button "l13, empty" [ref=e340] [cursor=pointer]
            - button "m13, empty" [ref=e341] [cursor=pointer]
            - button "n13, empty" [ref=e342] [cursor=pointer]
            - button "o13, empty" [ref=e343] [cursor=pointer]
            - generic [ref=e344]: "14"
            - button "a14, empty" [ref=e345] [cursor=pointer]
            - button "b14, empty" [ref=e346] [cursor=pointer]
            - button "c14, empty" [ref=e347] [cursor=pointer]
            - button "2L, d14, double letter, empty" [ref=e348] [cursor=pointer]:
              - generic [ref=e349]: 2L
            - button "e14, empty" [ref=e350] [cursor=pointer]
            - button "f14, empty" [ref=e351] [cursor=pointer]
            - button "2W, g14, double word, empty" [ref=e352] [cursor=pointer]:
              - generic [ref=e353]: 2W
            - button "h14, empty" [ref=e354] [cursor=pointer]
            - button "2W, i14, double word, empty" [ref=e355] [cursor=pointer]:
              - generic [ref=e356]: 2W
            - button "j14, empty" [ref=e357] [cursor=pointer]
            - button "k14, empty" [ref=e358] [cursor=pointer]
            - button "2L, l14, double letter, empty" [ref=e359] [cursor=pointer]:
              - generic [ref=e360]: 2L
            - button "m14, empty" [ref=e361] [cursor=pointer]
            - button "n14, empty" [ref=e362] [cursor=pointer]
            - button "o14, empty" [ref=e363] [cursor=pointer]
            - generic [ref=e364]: "15"
            - button "2L, a15, double letter, empty" [ref=e365] [cursor=pointer]:
              - generic [ref=e366]: 2L
            - button "b15, empty" [ref=e367] [cursor=pointer]
            - button "c15, empty" [ref=e368] [cursor=pointer]
            - button "d15, empty" [ref=e369] [cursor=pointer]
            - button "3W, e15, triple word, empty" [ref=e370] [cursor=pointer]:
              - generic [ref=e371]: 3W
            - button "f15, empty" [ref=e372] [cursor=pointer]
            - button "g15, empty" [ref=e373] [cursor=pointer]
            - button "2L, h15, double letter, empty" [ref=e374] [cursor=pointer]:
              - generic [ref=e375]: 2L
            - button "i15, empty" [ref=e376] [cursor=pointer]
            - button "j15, empty" [ref=e377] [cursor=pointer]
            - button "3W, k15, triple word, empty" [ref=e378] [cursor=pointer]:
              - generic [ref=e379]: 3W
            - button "l15, empty" [ref=e380] [cursor=pointer]
            - button "m15, empty" [ref=e381] [cursor=pointer]
            - button "n15, empty" [ref=e382] [cursor=pointer]
            - button "2L, o15, double letter, empty" [ref=e383] [cursor=pointer]:
              - generic [ref=e384]: 2L
        - img "Whole board overview; outline shows the enlarged area" [ref=e385]
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