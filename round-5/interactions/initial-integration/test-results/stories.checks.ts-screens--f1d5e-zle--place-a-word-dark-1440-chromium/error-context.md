# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-puzzle--place-a-word dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  141699 pixels (ratio 0.12 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-puzzle/place-a-word-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-puzzle/place-a-word-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 141699 pixels (ratio 0.12 of all image pixels) are different.
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
  - 141699 pixels (ratio 0.12 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e13]:
    - paragraph [ref=e14]: Score at least 20 points in one move.
    - alert [ref=e15]:
      - img [ref=e18]
      - generic [ref=e20]:
        - paragraph [ref=e21]: "Not in the word list: TOEEA"
        - paragraph [ref=e22]: Recall tiles to try another word. Your rack is kept.
    - generic [ref=e23]:
      - button "Play word" [disabled] [ref=e24]:
        - paragraph [ref=e27]: Play word
      - button "Recall tiles" [ref=e28] [cursor=pointer]:
        - paragraph [ref=e31]: Recall tiles
    - group "Your rack" [ref=e32]:
      - button "A, 1 points, on the board" [disabled] [ref=e33]
      - button "E, 1 points, on the board" [disabled] [ref=e34]
      - button "S, 1 points" [ref=e35] [cursor=pointer]:
        - generic [ref=e36]: S
        - generic [ref=e37]: "1"
      - button "T, 1 points" [ref=e38] [cursor=pointer]:
        - generic [ref=e39]: T
        - generic [ref=e40]: "1"
      - button "Blank, 0 points" [ref=e41] [cursor=pointer]:
        - generic [ref=e42]: "0"
      - button "R, 1 points" [ref=e43] [cursor=pointer]:
        - generic [ref=e44]: R
        - generic [ref=e45]: "1"
      - button "N, 1 points" [ref=e46] [cursor=pointer]:
        - generic [ref=e47]: "N"
        - generic [ref=e48]: "1"
    - paragraph [ref=e49]: "i12: No bonus on this square."
    - generic [ref=e50]:
      - generic [ref=e51]:
        - button "Fit board" [pressed] [ref=e52] [cursor=pointer]:
          - paragraph [ref=e55]: Fit board
        - button "Enlarge board" [ref=e56] [cursor=pointer]:
          - paragraph [ref=e59]: Enlarge board
      - region "Scrollable word board" [ref=e61]:
        - group "Puzzle board, fifteen columns and fifteen rows" [ref=e62]:
          - generic [ref=e64]: a
          - generic [ref=e65]: b
          - generic [ref=e66]: c
          - generic [ref=e67]: d
          - generic [ref=e68]: e
          - generic [ref=e69]: f
          - generic [ref=e70]: g
          - generic [ref=e71]: h
          - generic [ref=e72]: i
          - generic [ref=e73]: j
          - generic [ref=e74]: k
          - generic [ref=e75]: l
          - generic [ref=e76]: m
          - generic [ref=e77]: "n"
          - generic [ref=e78]: o
          - generic [ref=e79]: "1"
          - button "2L, a1, double letter, empty" [ref=e80] [cursor=pointer]:
            - generic [ref=e81]: 2L
          - button "b1, empty" [ref=e82] [cursor=pointer]
          - button "c1, empty" [ref=e83] [cursor=pointer]
          - button "d1, empty" [ref=e84] [cursor=pointer]
          - button "3W, e1, triple word, empty" [ref=e85] [cursor=pointer]:
            - generic [ref=e86]: 3W
          - button "f1, empty" [ref=e87] [cursor=pointer]
          - button "g1, empty" [ref=e88] [cursor=pointer]
          - button "2L, h1, double letter, empty" [ref=e89] [cursor=pointer]:
            - generic [ref=e90]: 2L
          - button "i1, empty" [ref=e91] [cursor=pointer]
          - button "j1, empty" [ref=e92] [cursor=pointer]
          - button "3W, k1, triple word, empty" [ref=e93] [cursor=pointer]:
            - generic [ref=e94]: 3W
          - button "l1, empty" [ref=e95] [cursor=pointer]
          - button "m1, empty" [ref=e96] [cursor=pointer]
          - button "n1, empty" [ref=e97] [cursor=pointer]
          - button "2L, o1, double letter, empty" [ref=e98] [cursor=pointer]:
            - generic [ref=e99]: 2L
          - generic [ref=e100]: "2"
          - button "a2, empty" [ref=e101] [cursor=pointer]
          - button "b2, empty" [ref=e102] [cursor=pointer]
          - button "c2, empty" [ref=e103] [cursor=pointer]
          - button "2L, d2, double letter, empty" [ref=e104] [cursor=pointer]:
            - generic [ref=e105]: 2L
          - button "e2, empty" [ref=e106] [cursor=pointer]
          - button "f2, empty" [ref=e107] [cursor=pointer]
          - button "2W, g2, double word, empty" [ref=e108] [cursor=pointer]:
            - generic [ref=e109]: 2W
          - button "h2, empty" [ref=e110] [cursor=pointer]
          - button "2W, i2, double word, empty" [ref=e111] [cursor=pointer]:
            - generic [ref=e112]: 2W
          - button "j2, empty" [ref=e113] [cursor=pointer]
          - button "k2, empty" [ref=e114] [cursor=pointer]
          - button "2L, l2, double letter, empty" [ref=e115] [cursor=pointer]:
            - generic [ref=e116]: 2L
          - button "m2, empty" [ref=e117] [cursor=pointer]
          - button "n2, empty" [ref=e118] [cursor=pointer]
          - button "o2, empty" [ref=e119] [cursor=pointer]
          - generic [ref=e120]: "3"
          - button "a3, empty" [ref=e121] [cursor=pointer]
          - button "b3, empty" [ref=e122] [cursor=pointer]
          - button "c3, empty" [ref=e123] [cursor=pointer]
          - button "d3, empty" [ref=e124] [cursor=pointer]
          - button "3L, e3, triple letter, empty" [ref=e125] [cursor=pointer]:
            - generic [ref=e126]: 3L
          - button "f3, empty" [ref=e127] [cursor=pointer]
          - button "g3, empty" [ref=e128] [cursor=pointer]
          - button "h3, empty" [ref=e129] [cursor=pointer]
          - button "i3, empty" [ref=e130] [cursor=pointer]
          - button "j3, empty" [ref=e131] [cursor=pointer]
          - button "3L, k3, triple letter, empty" [ref=e132] [cursor=pointer]:
            - generic [ref=e133]: 3L
          - button "l3, empty" [ref=e134] [cursor=pointer]
          - button "m3, empty" [ref=e135] [cursor=pointer]
          - button "n3, empty" [ref=e136] [cursor=pointer]
          - button "o3, empty" [ref=e137] [cursor=pointer]
          - generic [ref=e138]: "4"
          - button "a4, empty" [ref=e139] [cursor=pointer]
          - button "2L, b4, double letter, empty" [ref=e140] [cursor=pointer]:
            - generic [ref=e141]: 2L
          - button "c4, empty" [ref=e142] [cursor=pointer]
          - button "2W, d4, double word, empty" [ref=e143] [cursor=pointer]:
            - generic [ref=e144]: 2W
          - button "e4, empty" [ref=e145] [cursor=pointer]
          - button "f4, empty" [ref=e146] [cursor=pointer]
          - button "g4, empty" [ref=e147] [cursor=pointer]
          - button "h4, empty" [ref=e148] [cursor=pointer]
          - button "i4, empty" [ref=e149] [cursor=pointer]
          - button "j4, empty" [ref=e150] [cursor=pointer]
          - button "k4, empty" [ref=e151] [cursor=pointer]
          - button "2W, l4, double word, empty" [ref=e152] [cursor=pointer]:
            - generic [ref=e153]: 2W
          - button "m4, empty" [ref=e154] [cursor=pointer]
          - button "2L, n4, double letter, empty" [ref=e155] [cursor=pointer]:
            - generic [ref=e156]: 2L
          - button "o4, empty" [ref=e157] [cursor=pointer]
          - generic [ref=e158]: "5"
          - button "3W, a5, triple word, empty" [ref=e159] [cursor=pointer]:
            - generic [ref=e160]: 3W
          - button "b5, empty" [ref=e161] [cursor=pointer]
          - button "3L, c5, triple letter, empty" [ref=e162] [cursor=pointer]:
            - generic [ref=e163]: 3L
          - button "d5, empty" [ref=e164] [cursor=pointer]
          - button "e5, empty" [ref=e165] [cursor=pointer]
          - button "f5, empty" [ref=e166] [cursor=pointer]
          - button "2L, g5, double letter, empty" [ref=e167] [cursor=pointer]:
            - generic [ref=e168]: 2L
          - button "h5, empty" [ref=e169] [cursor=pointer]
          - button "2L, i5, double letter, empty" [ref=e170] [cursor=pointer]:
            - generic [ref=e171]: 2L
          - button "j5, empty" [ref=e172] [cursor=pointer]
          - button "k5, empty" [ref=e173] [cursor=pointer]
          - button "l5, empty" [ref=e174] [cursor=pointer]
          - button "3L, m5, triple letter, empty" [ref=e175] [cursor=pointer]:
            - generic [ref=e176]: 3L
          - button "n5, empty" [ref=e177] [cursor=pointer]
          - button "3W, o5, triple word, empty" [ref=e178] [cursor=pointer]:
            - generic [ref=e179]: 3W
          - generic [ref=e180]: "6"
          - button "a6, empty" [ref=e181] [cursor=pointer]
          - button "b6, empty" [ref=e182] [cursor=pointer]
          - button "c6, empty" [ref=e183] [cursor=pointer]
          - button "d6, empty" [ref=e184] [cursor=pointer]
          - button "e6, empty" [ref=e185] [cursor=pointer]
          - button "f6, empty" [ref=e186] [cursor=pointer]
          - button "g6, empty" [ref=e187] [cursor=pointer]
          - button "3L, h6, triple letter, empty" [ref=e188] [cursor=pointer]:
            - generic [ref=e189]: 3L
          - button "i6, empty" [ref=e190] [cursor=pointer]
          - button "j6, empty" [ref=e191] [cursor=pointer]
          - button "k6, empty" [ref=e192] [cursor=pointer]
          - button "l6, empty" [ref=e193] [cursor=pointer]
          - button "m6, empty" [ref=e194] [cursor=pointer]
          - button "n6, empty" [ref=e195] [cursor=pointer]
          - button "o6, empty" [ref=e196] [cursor=pointer]
          - generic [ref=e197]: "7"
          - button "a7, empty" [ref=e198] [cursor=pointer]
          - button "2W, b7, double word, empty" [ref=e199] [cursor=pointer]:
            - generic [ref=e200]: 2W
          - button "c7, empty" [ref=e201] [cursor=pointer]
          - button "d7, empty" [ref=e202] [cursor=pointer]
          - button "2L, e7, double letter, empty" [ref=e203] [cursor=pointer]:
            - generic [ref=e204]: 2L
          - button "f7, empty" [ref=e205] [cursor=pointer]
          - button "2L, g7, double letter, empty" [ref=e206] [cursor=pointer]:
            - generic [ref=e207]: 2L
          - button "h7, empty" [ref=e208] [cursor=pointer]
          - button "2L, i7, double letter, empty" [ref=e209] [cursor=pointer]:
            - generic [ref=e210]: 2L
          - button "j7, empty" [ref=e211] [cursor=pointer]
          - button "2L, k7, double letter, empty" [ref=e212] [cursor=pointer]:
            - generic [ref=e213]: 2L
          - button "l7, empty" [ref=e214] [cursor=pointer]
          - button "m7, empty" [ref=e215] [cursor=pointer]
          - button "2W, n7, double word, empty" [ref=e216] [cursor=pointer]:
            - generic [ref=e217]: 2W
          - button "o7, empty" [ref=e218] [cursor=pointer]
          - generic [ref=e219]: "8"
          - button "2L, a8, double letter, empty" [ref=e220] [cursor=pointer]:
            - generic [ref=e221]: 2L
          - button "b8, empty" [ref=e222] [cursor=pointer]
          - button "c8, empty" [ref=e223] [cursor=pointer]
          - button "d8, empty" [ref=e224] [cursor=pointer]
          - button "e8, empty" [ref=e225] [cursor=pointer]
          - button "3L, f8, triple letter, empty" [ref=e226] [cursor=pointer]:
            - generic [ref=e227]: 3L
          - button "C 3, g8, committed" [disabled] [ref=e228]:
            - generic [ref=e229]: C
            - generic [ref=e230]: "3"
          - button "A 1, h8, committed" [disabled] [ref=e231]:
            - generic [ref=e232]: A
            - generic [ref=e233]: "1"
          - button "T 1, i8, committed" [disabled] [ref=e234]:
            - generic [ref=e235]: T
            - generic [ref=e236]: "1"
          - button "3L, j8, triple letter, empty" [ref=e237] [cursor=pointer]:
            - generic [ref=e238]: 3L
          - button "k8, empty" [ref=e239] [cursor=pointer]
          - button "l8, empty" [ref=e240] [cursor=pointer]
          - button "m8, empty" [ref=e241] [cursor=pointer]
          - button "n8, empty" [ref=e242] [cursor=pointer]
          - button "2L, o8, double letter, empty" [ref=e243] [cursor=pointer]:
            - generic [ref=e244]: 2L
          - generic [ref=e245]: "9"
          - button "a9, empty" [ref=e246] [cursor=pointer]
          - button "2W, b9, double word, empty" [ref=e247] [cursor=pointer]:
            - generic [ref=e248]: 2W
          - button "c9, empty" [ref=e249] [cursor=pointer]
          - button "d9, empty" [ref=e250] [cursor=pointer]
          - button "2L, e9, double letter, empty" [ref=e251] [cursor=pointer]:
            - generic [ref=e252]: 2L
          - button "f9, empty" [ref=e253] [cursor=pointer]
          - button "2L, g9, double letter, empty" [ref=e254] [cursor=pointer]:
            - generic [ref=e255]: 2L
          - button "h9, empty" [ref=e256] [cursor=pointer]
          - button "O 1, i9, committed" [disabled] [ref=e257]:
            - generic [ref=e258]: O
            - generic [ref=e259]: "1"
          - button "j9, empty" [ref=e260] [cursor=pointer]
          - button "2L, k9, double letter, empty" [ref=e261] [cursor=pointer]:
            - generic [ref=e262]: 2L
          - button "l9, empty" [ref=e263] [cursor=pointer]
          - button "m9, empty" [ref=e264] [cursor=pointer]
          - button "2W, n9, double word, empty" [ref=e265] [cursor=pointer]:
            - generic [ref=e266]: 2W
          - button "o9, empty" [ref=e267] [cursor=pointer]
          - generic [ref=e268]: "10"
          - button "a10, empty" [ref=e269] [cursor=pointer]
          - button "b10, empty" [ref=e270] [cursor=pointer]
          - button "c10, empty" [ref=e271] [cursor=pointer]
          - button "d10, empty" [ref=e272] [cursor=pointer]
          - button "e10, empty" [ref=e273] [cursor=pointer]
          - button "f10, empty" [ref=e274] [cursor=pointer]
          - button "g10, empty" [ref=e275] [cursor=pointer]
          - button "3L, h10, triple letter, empty" [ref=e276] [cursor=pointer]:
            - generic [ref=e277]: 3L
          - button "E 1, i10, committed" [disabled] [ref=e278]:
            - generic [ref=e279]: E
            - generic [ref=e280]: "1"
          - button "j10, empty" [ref=e281] [cursor=pointer]
          - button "k10, empty" [ref=e282] [cursor=pointer]
          - button "l10, empty" [ref=e283] [cursor=pointer]
          - button "m10, empty" [ref=e284] [cursor=pointer]
          - button "n10, empty" [ref=e285] [cursor=pointer]
          - button "o10, empty" [ref=e286] [cursor=pointer]
          - generic [ref=e287]: "11"
          - button "3W, a11, triple word, empty" [ref=e288] [cursor=pointer]:
            - generic [ref=e289]: 3W
          - button "b11, empty" [ref=e290] [cursor=pointer]
          - button "3L, c11, triple letter, empty" [ref=e291] [cursor=pointer]:
            - generic [ref=e292]: 3L
          - button "d11, empty" [ref=e293] [cursor=pointer]
          - button "e11, empty" [ref=e294] [cursor=pointer]
          - button "f11, empty" [ref=e295] [cursor=pointer]
          - button "2L, g11, double letter, empty" [ref=e296] [cursor=pointer]:
            - generic [ref=e297]: 2L
          - button "h11, empty" [ref=e298] [cursor=pointer]
          - button "E 1, i11, your tentative tile" [ref=e299] [cursor=pointer]:
            - generic [ref=e300]: E
            - generic [ref=e301]: "1"
          - button "j11, empty" [ref=e302] [cursor=pointer]
          - button "k11, empty" [ref=e303] [cursor=pointer]
          - button "l11, empty" [ref=e304] [cursor=pointer]
          - button "3L, m11, triple letter, empty" [ref=e305] [cursor=pointer]:
            - generic [ref=e306]: 3L
          - button "n11, empty" [ref=e307] [cursor=pointer]
          - button "3W, o11, triple word, empty" [ref=e308] [cursor=pointer]:
            - generic [ref=e309]: 3W
          - generic [ref=e310]: "12"
          - button "a12, empty" [ref=e311] [cursor=pointer]
          - button "2L, b12, double letter, empty" [ref=e312] [cursor=pointer]:
            - generic [ref=e313]: 2L
          - button "c12, empty" [ref=e314] [cursor=pointer]
          - button "2W, d12, double word, empty" [ref=e315] [cursor=pointer]:
            - generic [ref=e316]: 2W
          - button "e12, empty" [ref=e317] [cursor=pointer]
          - button "f12, empty" [ref=e318] [cursor=pointer]
          - button "g12, empty" [ref=e319] [cursor=pointer]
          - button "h12, empty" [ref=e320] [cursor=pointer]
          - button "A 1, i12, your tentative tile" [active] [ref=e321] [cursor=pointer]:
            - generic [ref=e322]: A
            - generic [ref=e323]: "1"
          - button "j12, empty" [ref=e324] [cursor=pointer]
          - button "k12, empty" [ref=e325] [cursor=pointer]
          - button "2W, l12, double word, empty" [ref=e326] [cursor=pointer]:
            - generic [ref=e327]: 2W
          - button "m12, empty" [ref=e328] [cursor=pointer]
          - button "2L, n12, double letter, empty" [ref=e329] [cursor=pointer]:
            - generic [ref=e330]: 2L
          - button "o12, empty" [ref=e331] [cursor=pointer]
          - generic [ref=e332]: "13"
          - button "a13, empty" [ref=e333] [cursor=pointer]
          - button "b13, empty" [ref=e334] [cursor=pointer]
          - button "c13, empty" [ref=e335] [cursor=pointer]
          - button "d13, empty" [ref=e336] [cursor=pointer]
          - button "3L, e13, triple letter, empty" [ref=e337] [cursor=pointer]:
            - generic [ref=e338]: 3L
          - button "f13, empty" [ref=e339] [cursor=pointer]
          - button "g13, empty" [ref=e340] [cursor=pointer]
          - button "h13, empty" [ref=e341] [cursor=pointer]
          - button "i13, empty" [ref=e342] [cursor=pointer]
          - button "j13, empty" [ref=e343] [cursor=pointer]
          - button "3L, k13, triple letter, empty" [ref=e344] [cursor=pointer]:
            - generic [ref=e345]: 3L
          - button "l13, empty" [ref=e346] [cursor=pointer]
          - button "m13, empty" [ref=e347] [cursor=pointer]
          - button "n13, empty" [ref=e348] [cursor=pointer]
          - button "o13, empty" [ref=e349] [cursor=pointer]
          - generic [ref=e350]: "14"
          - button "a14, empty" [ref=e351] [cursor=pointer]
          - button "b14, empty" [ref=e352] [cursor=pointer]
          - button "c14, empty" [ref=e353] [cursor=pointer]
          - button "2L, d14, double letter, empty" [ref=e354] [cursor=pointer]:
            - generic [ref=e355]: 2L
          - button "e14, empty" [ref=e356] [cursor=pointer]
          - button "f14, empty" [ref=e357] [cursor=pointer]
          - button "2W, g14, double word, empty" [ref=e358] [cursor=pointer]:
            - generic [ref=e359]: 2W
          - button "h14, empty" [ref=e360] [cursor=pointer]
          - button "2W, i14, double word, empty" [ref=e361] [cursor=pointer]:
            - generic [ref=e362]: 2W
          - button "j14, empty" [ref=e363] [cursor=pointer]
          - button "k14, empty" [ref=e364] [cursor=pointer]
          - button "2L, l14, double letter, empty" [ref=e365] [cursor=pointer]:
            - generic [ref=e366]: 2L
          - button "m14, empty" [ref=e367] [cursor=pointer]
          - button "n14, empty" [ref=e368] [cursor=pointer]
          - button "o14, empty" [ref=e369] [cursor=pointer]
          - generic [ref=e370]: "15"
          - button "2L, a15, double letter, empty" [ref=e371] [cursor=pointer]:
            - generic [ref=e372]: 2L
          - button "b15, empty" [ref=e373] [cursor=pointer]
          - button "c15, empty" [ref=e374] [cursor=pointer]
          - button "d15, empty" [ref=e375] [cursor=pointer]
          - button "3W, e15, triple word, empty" [ref=e376] [cursor=pointer]:
            - generic [ref=e377]: 3W
          - button "f15, empty" [ref=e378] [cursor=pointer]
          - button "g15, empty" [ref=e379] [cursor=pointer]
          - button "2L, h15, double letter, empty" [ref=e380] [cursor=pointer]:
            - generic [ref=e381]: 2L
          - button "i15, empty" [ref=e382] [cursor=pointer]
          - button "j15, empty" [ref=e383] [cursor=pointer]
          - button "3W, k15, triple word, empty" [ref=e384] [cursor=pointer]:
            - generic [ref=e385]: 3W
          - button "l15, empty" [ref=e386] [cursor=pointer]
          - button "m15, empty" [ref=e387] [cursor=pointer]
          - button "n15, empty" [ref=e388] [cursor=pointer]
          - button "2L, o15, double letter, empty" [ref=e389] [cursor=pointer]:
            - generic [ref=e390]: 2L
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