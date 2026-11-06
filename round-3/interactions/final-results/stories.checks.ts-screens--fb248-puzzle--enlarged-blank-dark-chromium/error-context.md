# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-puzzle--enlarged-blank dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  62948 pixels (ratio 0.20 of all image pixels) are different.

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
  - 62948 pixels (ratio 0.20 of all image pixels) are different.
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
  - 62948 pixels (ratio 0.20 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e10]:
    - paragraph [ref=e11]: Score at least 20 points in one move.
    - group "Your rack" [ref=e12]:
      - button "A, 1 points" [ref=e13] [cursor=pointer]:
        - generic [ref=e14]: A
        - generic [ref=e15]: "1"
      - button "E, 1 points" [ref=e16] [cursor=pointer]:
        - generic [ref=e17]: E
        - generic [ref=e18]: "1"
      - button "S, 1 points" [ref=e19] [cursor=pointer]:
        - generic [ref=e20]: S
        - generic [ref=e21]: "1"
      - button "T, 1 points" [ref=e22] [cursor=pointer]:
        - generic [ref=e23]: T
        - generic [ref=e24]: "1"
      - button "Blank, 0 points, on the board" [disabled] [ref=e25]
      - button "R, 1 points" [ref=e26] [cursor=pointer]:
        - generic [ref=e27]: R
        - generic [ref=e28]: "1"
      - button "N, 1 points" [ref=e29] [cursor=pointer]:
        - generic [ref=e30]: "N"
        - generic [ref=e31]: "1"
    - generic [ref=e32]:
      - paragraph [ref=e33]: "CATS: 5 = 5"
      - status [ref=e34]: Scores 5 points.
    - generic [ref=e35]:
      - button "Play word" [ref=e36] [cursor=pointer]:
        - paragraph [ref=e39]: Play word
      - button "Recall tiles" [ref=e40] [cursor=pointer]:
        - paragraph [ref=e43]: Recall tiles
    - generic [ref=e44]:
      - generic [ref=e45]:
        - button "Fit board" [ref=e46] [cursor=pointer]:
          - paragraph [ref=e49]: Fit board
        - button "Enlarge board" [pressed] [ref=e50] [cursor=pointer]:
          - paragraph [ref=e53]: Enlarge board
      - paragraph [ref=e54]: Scroll to explore. Arrow keys move between squares; Enter places your selected tile.
      - region "Scrollable word board" [ref=e55]:
        - group "Puzzle board, fifteen columns and fifteen rows" [ref=e56]:
          - generic [ref=e58]: a
          - generic [ref=e59]: b
          - generic [ref=e60]: c
          - generic [ref=e61]: d
          - generic [ref=e62]: e
          - generic [ref=e63]: f
          - generic [ref=e64]: g
          - generic [ref=e65]: h
          - generic [ref=e66]: i
          - generic [ref=e67]: j
          - generic [ref=e68]: k
          - generic [ref=e69]: l
          - generic [ref=e70]: m
          - generic [ref=e71]: "n"
          - generic [ref=e72]: o
          - generic [ref=e73]: "1"
          - button "2L, a1, double letter, empty" [ref=e74] [cursor=pointer]:
            - generic [ref=e75]: 2L
          - button "b1, empty" [ref=e76] [cursor=pointer]
          - button "c1, empty" [ref=e77] [cursor=pointer]
          - button "d1, empty" [ref=e78] [cursor=pointer]
          - button "3W, e1, triple word, empty" [ref=e79] [cursor=pointer]:
            - generic [ref=e80]: 3W
          - button "f1, empty" [ref=e81] [cursor=pointer]
          - button "g1, empty" [ref=e82] [cursor=pointer]
          - button "2L, h1, double letter, empty" [ref=e83] [cursor=pointer]:
            - generic [ref=e84]: 2L
          - button "i1, empty" [ref=e85] [cursor=pointer]
          - button "j1, empty" [ref=e86] [cursor=pointer]
          - button "3W, k1, triple word, empty" [ref=e87] [cursor=pointer]:
            - generic [ref=e88]: 3W
          - button "l1, empty" [ref=e89] [cursor=pointer]
          - button "m1, empty" [ref=e90] [cursor=pointer]
          - button "n1, empty" [ref=e91] [cursor=pointer]
          - button "2L, o1, double letter, empty" [ref=e92] [cursor=pointer]:
            - generic [ref=e93]: 2L
          - generic [ref=e94]: "2"
          - button "a2, empty" [ref=e95] [cursor=pointer]
          - button "b2, empty" [ref=e96] [cursor=pointer]
          - button "c2, empty" [ref=e97] [cursor=pointer]
          - button "2L, d2, double letter, empty" [ref=e98] [cursor=pointer]:
            - generic [ref=e99]: 2L
          - button "e2, empty" [ref=e100] [cursor=pointer]
          - button "f2, empty" [ref=e101] [cursor=pointer]
          - button "2W, g2, double word, empty" [ref=e102] [cursor=pointer]:
            - generic [ref=e103]: 2W
          - button "h2, empty" [ref=e104] [cursor=pointer]
          - button "2W, i2, double word, empty" [ref=e105] [cursor=pointer]:
            - generic [ref=e106]: 2W
          - button "j2, empty" [ref=e107] [cursor=pointer]
          - button "k2, empty" [ref=e108] [cursor=pointer]
          - button "2L, l2, double letter, empty" [ref=e109] [cursor=pointer]:
            - generic [ref=e110]: 2L
          - button "m2, empty" [ref=e111] [cursor=pointer]
          - button "n2, empty" [ref=e112] [cursor=pointer]
          - button "o2, empty" [ref=e113] [cursor=pointer]
          - generic [ref=e114]: "3"
          - button "a3, empty" [ref=e115] [cursor=pointer]
          - button "b3, empty" [ref=e116] [cursor=pointer]
          - button "c3, empty" [ref=e117] [cursor=pointer]
          - button "d3, empty" [ref=e118] [cursor=pointer]
          - button "3L, e3, triple letter, empty" [ref=e119] [cursor=pointer]:
            - generic [ref=e120]: 3L
          - button "f3, empty" [ref=e121] [cursor=pointer]
          - button "g3, empty" [ref=e122] [cursor=pointer]
          - button "h3, empty" [ref=e123] [cursor=pointer]
          - button "i3, empty" [ref=e124] [cursor=pointer]
          - button "j3, empty" [ref=e125] [cursor=pointer]
          - button "3L, k3, triple letter, empty" [ref=e126] [cursor=pointer]:
            - generic [ref=e127]: 3L
          - button "l3, empty" [ref=e128] [cursor=pointer]
          - button "m3, empty" [ref=e129] [cursor=pointer]
          - button "n3, empty" [ref=e130] [cursor=pointer]
          - button "o3, empty" [ref=e131] [cursor=pointer]
          - generic [ref=e132]: "4"
          - button "a4, empty" [ref=e133] [cursor=pointer]
          - button "2L, b4, double letter, empty" [ref=e134] [cursor=pointer]:
            - generic [ref=e135]: 2L
          - button "c4, empty" [ref=e136] [cursor=pointer]
          - button "2W, d4, double word, empty" [ref=e137] [cursor=pointer]:
            - generic [ref=e138]: 2W
          - button "e4, empty" [ref=e139] [cursor=pointer]
          - button "f4, empty" [ref=e140] [cursor=pointer]
          - button "g4, empty" [ref=e141] [cursor=pointer]
          - button "h4, empty" [ref=e142] [cursor=pointer]
          - button "i4, empty" [ref=e143] [cursor=pointer]
          - button "j4, empty" [ref=e144] [cursor=pointer]
          - button "k4, empty" [ref=e145] [cursor=pointer]
          - button "2W, l4, double word, empty" [ref=e146] [cursor=pointer]:
            - generic [ref=e147]: 2W
          - button "m4, empty" [ref=e148] [cursor=pointer]
          - button "2L, n4, double letter, empty" [ref=e149] [cursor=pointer]:
            - generic [ref=e150]: 2L
          - button "o4, empty" [ref=e151] [cursor=pointer]
          - generic [ref=e152]: "5"
          - button "3W, a5, triple word, empty" [ref=e153] [cursor=pointer]:
            - generic [ref=e154]: 3W
          - button "b5, empty" [ref=e155] [cursor=pointer]
          - button "3L, c5, triple letter, empty" [ref=e156] [cursor=pointer]:
            - generic [ref=e157]: 3L
          - button "d5, empty" [ref=e158] [cursor=pointer]
          - button "e5, empty" [ref=e159] [cursor=pointer]
          - button "f5, empty" [ref=e160] [cursor=pointer]
          - button "2L, g5, double letter, empty" [ref=e161] [cursor=pointer]:
            - generic [ref=e162]: 2L
          - button "h5, empty" [ref=e163] [cursor=pointer]
          - button "2L, i5, double letter, empty" [ref=e164] [cursor=pointer]:
            - generic [ref=e165]: 2L
          - button "j5, empty" [ref=e166] [cursor=pointer]
          - button "k5, empty" [ref=e167] [cursor=pointer]
          - button "l5, empty" [ref=e168] [cursor=pointer]
          - button "3L, m5, triple letter, empty" [ref=e169] [cursor=pointer]:
            - generic [ref=e170]: 3L
          - button "n5, empty" [ref=e171] [cursor=pointer]
          - button "3W, o5, triple word, empty" [ref=e172] [cursor=pointer]:
            - generic [ref=e173]: 3W
          - generic [ref=e174]: "6"
          - button "a6, empty" [ref=e175] [cursor=pointer]
          - button "b6, empty" [ref=e176] [cursor=pointer]
          - button "c6, empty" [ref=e177] [cursor=pointer]
          - button "d6, empty" [ref=e178] [cursor=pointer]
          - button "e6, empty" [ref=e179] [cursor=pointer]
          - button "f6, empty" [ref=e180] [cursor=pointer]
          - button "g6, empty" [ref=e181] [cursor=pointer]
          - button "3L, h6, triple letter, empty" [ref=e182] [cursor=pointer]:
            - generic [ref=e183]: 3L
          - button "i6, empty" [ref=e184] [cursor=pointer]
          - button "j6, empty" [ref=e185] [cursor=pointer]
          - button "k6, empty" [ref=e186] [cursor=pointer]
          - button "l6, empty" [ref=e187] [cursor=pointer]
          - button "m6, empty" [ref=e188] [cursor=pointer]
          - button "n6, empty" [ref=e189] [cursor=pointer]
          - button "o6, empty" [ref=e190] [cursor=pointer]
          - generic [ref=e191]: "7"
          - button "a7, empty" [ref=e192] [cursor=pointer]
          - button "2W, b7, double word, empty" [ref=e193] [cursor=pointer]:
            - generic [ref=e194]: 2W
          - button "c7, empty" [ref=e195] [cursor=pointer]
          - button "d7, empty" [ref=e196] [cursor=pointer]
          - button "2L, e7, double letter, empty" [ref=e197] [cursor=pointer]:
            - generic [ref=e198]: 2L
          - button "f7, empty" [ref=e199] [cursor=pointer]
          - button "2L, g7, double letter, empty" [ref=e200] [cursor=pointer]:
            - generic [ref=e201]: 2L
          - button "h7, empty" [ref=e202] [cursor=pointer]
          - button "2L, i7, double letter, empty" [ref=e203] [cursor=pointer]:
            - generic [ref=e204]: 2L
          - button "j7, empty" [ref=e205] [cursor=pointer]
          - button "2L, k7, double letter, empty" [ref=e206] [cursor=pointer]:
            - generic [ref=e207]: 2L
          - button "l7, empty" [ref=e208] [cursor=pointer]
          - button "m7, empty" [ref=e209] [cursor=pointer]
          - button "2W, n7, double word, empty" [ref=e210] [cursor=pointer]:
            - generic [ref=e211]: 2W
          - button "o7, empty" [ref=e212] [cursor=pointer]
          - generic [ref=e213]: "8"
          - button "2L, a8, double letter, empty" [ref=e214] [cursor=pointer]:
            - generic [ref=e215]: 2L
          - button "b8, empty" [ref=e216] [cursor=pointer]
          - button "c8, empty" [ref=e217] [cursor=pointer]
          - button "d8, empty" [ref=e218] [cursor=pointer]
          - button "e8, empty" [ref=e219] [cursor=pointer]
          - button "3L, f8, triple letter, empty" [ref=e220] [cursor=pointer]:
            - generic [ref=e221]: 3L
          - button "C 3, g8, committed" [disabled] [ref=e222]:
            - generic [ref=e223]: C
            - generic [ref=e224]: "3"
          - button "A 1, h8, committed" [disabled] [ref=e225]:
            - generic [ref=e226]: A
            - generic [ref=e227]: "1"
          - button "T 1, i8, committed" [disabled] [ref=e228]:
            - generic [ref=e229]: T
            - generic [ref=e230]: "1"
          - button "S 0, j8, your tentative blank as S" [ref=e231] [cursor=pointer]:
            - generic [ref=e232]: S
            - generic [ref=e233]: "0"
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
            - generic [ref=e254]: "1"
          - button "j9, empty" [ref=e255] [cursor=pointer]
          - button "2L, k9, double letter, empty" [ref=e256] [cursor=pointer]:
            - generic [ref=e257]: 2L
          - button "l9, empty" [ref=e258] [cursor=pointer]
          - button "m9, empty" [ref=e259] [cursor=pointer]
          - button "2W, n9, double word, empty" [ref=e260] [cursor=pointer]:
            - generic [ref=e261]: 2W
          - button "o9, empty" [ref=e262] [cursor=pointer]
          - generic [ref=e263]: "10"
          - button "a10, empty" [ref=e264] [cursor=pointer]
          - button "b10, empty" [ref=e265] [cursor=pointer]
          - button "c10, empty" [ref=e266] [cursor=pointer]
          - button "d10, empty" [ref=e267] [cursor=pointer]
          - button "e10, empty" [ref=e268] [cursor=pointer]
          - button "f10, empty" [ref=e269] [cursor=pointer]
          - button "g10, empty" [ref=e270] [cursor=pointer]
          - button "3L, h10, triple letter, empty" [ref=e271] [cursor=pointer]:
            - generic [ref=e272]: 3L
          - button "E 1, i10, committed" [disabled] [ref=e273]:
            - generic [ref=e274]: E
            - generic [ref=e275]: "1"
          - button "j10, empty" [ref=e276] [cursor=pointer]
          - button "k10, empty" [ref=e277] [cursor=pointer]
          - button "l10, empty" [ref=e278] [cursor=pointer]
          - button "m10, empty" [ref=e279] [cursor=pointer]
          - button "n10, empty" [ref=e280] [cursor=pointer]
          - button "o10, empty" [ref=e281] [cursor=pointer]
          - generic [ref=e282]: "11"
          - button "3W, a11, triple word, empty" [ref=e283] [cursor=pointer]:
            - generic [ref=e284]: 3W
          - button "b11, empty" [ref=e285] [cursor=pointer]
          - button "3L, c11, triple letter, empty" [ref=e286] [cursor=pointer]:
            - generic [ref=e287]: 3L
          - button "d11, empty" [ref=e288] [cursor=pointer]
          - button "e11, empty" [ref=e289] [cursor=pointer]
          - button "f11, empty" [ref=e290] [cursor=pointer]
          - button "2L, g11, double letter, empty" [ref=e291] [cursor=pointer]:
            - generic [ref=e292]: 2L
          - button "h11, empty" [ref=e293] [cursor=pointer]
          - button "2L, i11, double letter, empty" [ref=e294] [cursor=pointer]:
            - generic [ref=e295]: 2L
          - button "j11, empty" [ref=e296] [cursor=pointer]
          - button "k11, empty" [ref=e297] [cursor=pointer]
          - button "l11, empty" [ref=e298] [cursor=pointer]
          - button "3L, m11, triple letter, empty" [ref=e299] [cursor=pointer]:
            - generic [ref=e300]: 3L
          - button "n11, empty" [ref=e301] [cursor=pointer]
          - button "3W, o11, triple word, empty" [ref=e302] [cursor=pointer]:
            - generic [ref=e303]: 3W
          - generic [ref=e304]: "12"
          - button "a12, empty" [ref=e305] [cursor=pointer]
          - button "2L, b12, double letter, empty" [ref=e306] [cursor=pointer]:
            - generic [ref=e307]: 2L
          - button "c12, empty" [ref=e308] [cursor=pointer]
          - button "2W, d12, double word, empty" [ref=e309] [cursor=pointer]:
            - generic [ref=e310]: 2W
          - button "e12, empty" [ref=e311] [cursor=pointer]
          - button "f12, empty" [ref=e312] [cursor=pointer]
          - button "g12, empty" [ref=e313] [cursor=pointer]
          - button "h12, empty" [ref=e314] [cursor=pointer]
          - button "i12, empty" [ref=e315] [cursor=pointer]
          - button "j12, empty" [ref=e316] [cursor=pointer]
          - button "k12, empty" [ref=e317] [cursor=pointer]
          - button "2W, l12, double word, empty" [ref=e318] [cursor=pointer]:
            - generic [ref=e319]: 2W
          - button "m12, empty" [ref=e320] [cursor=pointer]
          - button "2L, n12, double letter, empty" [ref=e321] [cursor=pointer]:
            - generic [ref=e322]: 2L
          - button "o12, empty" [ref=e323] [cursor=pointer]
          - generic [ref=e324]: "13"
          - button "a13, empty" [ref=e325] [cursor=pointer]
          - button "b13, empty" [ref=e326] [cursor=pointer]
          - button "c13, empty" [ref=e327] [cursor=pointer]
          - button "d13, empty" [ref=e328] [cursor=pointer]
          - button "3L, e13, triple letter, empty" [ref=e329] [cursor=pointer]:
            - generic [ref=e330]: 3L
          - button "f13, empty" [ref=e331] [cursor=pointer]
          - button "g13, empty" [ref=e332] [cursor=pointer]
          - button "h13, empty" [ref=e333] [cursor=pointer]
          - button "i13, empty" [ref=e334] [cursor=pointer]
          - button "j13, empty" [ref=e335] [cursor=pointer]
          - button "3L, k13, triple letter, empty" [ref=e336] [cursor=pointer]:
            - generic [ref=e337]: 3L
          - button "l13, empty" [ref=e338] [cursor=pointer]
          - button "m13, empty" [ref=e339] [cursor=pointer]
          - button "n13, empty" [ref=e340] [cursor=pointer]
          - button "o13, empty" [ref=e341] [cursor=pointer]
          - generic [ref=e342]: "14"
          - button "a14, empty" [ref=e343] [cursor=pointer]
          - button "b14, empty" [ref=e344] [cursor=pointer]
          - button "c14, empty" [ref=e345] [cursor=pointer]
          - button "2L, d14, double letter, empty" [ref=e346] [cursor=pointer]:
            - generic [ref=e347]: 2L
          - button "e14, empty" [ref=e348] [cursor=pointer]
          - button "f14, empty" [ref=e349] [cursor=pointer]
          - button "2W, g14, double word, empty" [ref=e350] [cursor=pointer]:
            - generic [ref=e351]: 2W
          - button "h14, empty" [ref=e352] [cursor=pointer]
          - button "2W, i14, double word, empty" [ref=e353] [cursor=pointer]:
            - generic [ref=e354]: 2W
          - button "j14, empty" [ref=e355] [cursor=pointer]
          - button "k14, empty" [ref=e356] [cursor=pointer]
          - button "2L, l14, double letter, empty" [ref=e357] [cursor=pointer]:
            - generic [ref=e358]: 2L
          - button "m14, empty" [ref=e359] [cursor=pointer]
          - button "n14, empty" [ref=e360] [cursor=pointer]
          - button "o14, empty" [ref=e361] [cursor=pointer]
          - generic [ref=e362]: "15"
          - button "2L, a15, double letter, empty" [ref=e363] [cursor=pointer]:
            - generic [ref=e364]: 2L
          - button "b15, empty" [ref=e365] [cursor=pointer]
          - button "c15, empty" [ref=e366] [cursor=pointer]
          - button "d15, empty" [ref=e367] [cursor=pointer]
          - button "3W, e15, triple word, empty" [ref=e368] [cursor=pointer]:
            - generic [ref=e369]: 3W
          - button "f15, empty" [ref=e370] [cursor=pointer]
          - button "g15, empty" [ref=e371] [cursor=pointer]
          - button "2L, h15, double letter, empty" [ref=e372] [cursor=pointer]:
            - generic [ref=e373]: 2L
          - button "i15, empty" [ref=e374] [cursor=pointer]
          - button "j15, empty" [ref=e375] [cursor=pointer]
          - button "3W, k15, triple word, empty" [ref=e376] [cursor=pointer]:
            - generic [ref=e377]: 3W
          - button "l15, empty" [ref=e378] [cursor=pointer]
          - button "m15, empty" [ref=e379] [cursor=pointer]
          - button "n15, empty" [ref=e380] [cursor=pointer]
          - button "2L, o15, double letter, empty" [ref=e381] [cursor=pointer]:
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