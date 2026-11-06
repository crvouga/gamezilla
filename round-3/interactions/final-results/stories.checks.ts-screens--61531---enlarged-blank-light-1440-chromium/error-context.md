# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-puzzle--enlarged-blank light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-puzzle/enlarged-blank-light-1440.png.
```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e13]:
    - paragraph [ref=e14]: Score at least 20 points in one move.
    - group "Your rack" [ref=e15]:
      - button "A, 1 points" [ref=e16] [cursor=pointer]:
        - generic [ref=e17]: A
        - generic [ref=e18]: "1"
      - button "E, 1 points" [ref=e19] [cursor=pointer]:
        - generic [ref=e20]: E
        - generic [ref=e21]: "1"
      - button "S, 1 points" [ref=e22] [cursor=pointer]:
        - generic [ref=e23]: S
        - generic [ref=e24]: "1"
      - button "T, 1 points" [ref=e25] [cursor=pointer]:
        - generic [ref=e26]: T
        - generic [ref=e27]: "1"
      - button "Blank, 0 points, on the board" [disabled] [ref=e28]
      - button "R, 1 points" [ref=e29] [cursor=pointer]:
        - generic [ref=e30]: R
        - generic [ref=e31]: "1"
      - button "N, 1 points" [ref=e32] [cursor=pointer]:
        - generic [ref=e33]: "N"
        - generic [ref=e34]: "1"
    - generic [ref=e35]:
      - paragraph [ref=e36]: "CATS: 5 = 5"
      - status [ref=e37]: Scores 5 points.
    - generic [ref=e38]:
      - button "Play word" [ref=e39] [cursor=pointer]:
        - paragraph [ref=e42]: Play word
      - button "Recall tiles" [ref=e43] [cursor=pointer]:
        - paragraph [ref=e46]: Recall tiles
    - generic [ref=e47]:
      - generic [ref=e48]:
        - button "Fit board" [ref=e49] [cursor=pointer]:
          - paragraph [ref=e52]: Fit board
        - button "Enlarge board" [pressed] [ref=e53] [cursor=pointer]:
          - paragraph [ref=e56]: Enlarge board
      - paragraph [ref=e57]: Scroll to explore. Arrow keys move between squares; Enter places your selected tile.
      - region "Scrollable word board" [ref=e58]:
        - group "Puzzle board, fifteen columns and fifteen rows" [ref=e59]:
          - generic [ref=e61]: a
          - generic [ref=e62]: b
          - generic [ref=e63]: c
          - generic [ref=e64]: d
          - generic [ref=e65]: e
          - generic [ref=e66]: f
          - generic [ref=e67]: g
          - generic [ref=e68]: h
          - generic [ref=e69]: i
          - generic [ref=e70]: j
          - generic [ref=e71]: k
          - generic [ref=e72]: l
          - generic [ref=e73]: m
          - generic [ref=e74]: "n"
          - generic [ref=e75]: o
          - generic [ref=e76]: "1"
          - button "2L, a1, double letter, empty" [ref=e77] [cursor=pointer]:
            - generic [ref=e78]: 2L
          - button "b1, empty" [ref=e79] [cursor=pointer]
          - button "c1, empty" [ref=e80] [cursor=pointer]
          - button "d1, empty" [ref=e81] [cursor=pointer]
          - button "3W, e1, triple word, empty" [ref=e82] [cursor=pointer]:
            - generic [ref=e83]: 3W
          - button "f1, empty" [ref=e84] [cursor=pointer]
          - button "g1, empty" [ref=e85] [cursor=pointer]
          - button "2L, h1, double letter, empty" [ref=e86] [cursor=pointer]:
            - generic [ref=e87]: 2L
          - button "i1, empty" [ref=e88] [cursor=pointer]
          - button "j1, empty" [ref=e89] [cursor=pointer]
          - button "3W, k1, triple word, empty" [ref=e90] [cursor=pointer]:
            - generic [ref=e91]: 3W
          - button "l1, empty" [ref=e92] [cursor=pointer]
          - button "m1, empty" [ref=e93] [cursor=pointer]
          - button "n1, empty" [ref=e94] [cursor=pointer]
          - button "2L, o1, double letter, empty" [ref=e95] [cursor=pointer]:
            - generic [ref=e96]: 2L
          - generic [ref=e97]: "2"
          - button "a2, empty" [ref=e98] [cursor=pointer]
          - button "b2, empty" [ref=e99] [cursor=pointer]
          - button "c2, empty" [ref=e100] [cursor=pointer]
          - button "2L, d2, double letter, empty" [ref=e101] [cursor=pointer]:
            - generic [ref=e102]: 2L
          - button "e2, empty" [ref=e103] [cursor=pointer]
          - button "f2, empty" [ref=e104] [cursor=pointer]
          - button "2W, g2, double word, empty" [ref=e105] [cursor=pointer]:
            - generic [ref=e106]: 2W
          - button "h2, empty" [ref=e107] [cursor=pointer]
          - button "2W, i2, double word, empty" [ref=e108] [cursor=pointer]:
            - generic [ref=e109]: 2W
          - button "j2, empty" [ref=e110] [cursor=pointer]
          - button "k2, empty" [ref=e111] [cursor=pointer]
          - button "2L, l2, double letter, empty" [ref=e112] [cursor=pointer]:
            - generic [ref=e113]: 2L
          - button "m2, empty" [ref=e114] [cursor=pointer]
          - button "n2, empty" [ref=e115] [cursor=pointer]
          - button "o2, empty" [ref=e116] [cursor=pointer]
          - generic [ref=e117]: "3"
          - button "a3, empty" [ref=e118] [cursor=pointer]
          - button "b3, empty" [ref=e119] [cursor=pointer]
          - button "c3, empty" [ref=e120] [cursor=pointer]
          - button "d3, empty" [ref=e121] [cursor=pointer]
          - button "3L, e3, triple letter, empty" [ref=e122] [cursor=pointer]:
            - generic [ref=e123]: 3L
          - button "f3, empty" [ref=e124] [cursor=pointer]
          - button "g3, empty" [ref=e125] [cursor=pointer]
          - button "h3, empty" [ref=e126] [cursor=pointer]
          - button "i3, empty" [ref=e127] [cursor=pointer]
          - button "j3, empty" [ref=e128] [cursor=pointer]
          - button "3L, k3, triple letter, empty" [ref=e129] [cursor=pointer]:
            - generic [ref=e130]: 3L
          - button "l3, empty" [ref=e131] [cursor=pointer]
          - button "m3, empty" [ref=e132] [cursor=pointer]
          - button "n3, empty" [ref=e133] [cursor=pointer]
          - button "o3, empty" [ref=e134] [cursor=pointer]
          - generic [ref=e135]: "4"
          - button "a4, empty" [ref=e136] [cursor=pointer]
          - button "2L, b4, double letter, empty" [ref=e137] [cursor=pointer]:
            - generic [ref=e138]: 2L
          - button "c4, empty" [ref=e139] [cursor=pointer]
          - button "2W, d4, double word, empty" [ref=e140] [cursor=pointer]:
            - generic [ref=e141]: 2W
          - button "e4, empty" [ref=e142] [cursor=pointer]
          - button "f4, empty" [ref=e143] [cursor=pointer]
          - button "g4, empty" [ref=e144] [cursor=pointer]
          - button "h4, empty" [ref=e145] [cursor=pointer]
          - button "i4, empty" [ref=e146] [cursor=pointer]
          - button "j4, empty" [ref=e147] [cursor=pointer]
          - button "k4, empty" [ref=e148] [cursor=pointer]
          - button "2W, l4, double word, empty" [ref=e149] [cursor=pointer]:
            - generic [ref=e150]: 2W
          - button "m4, empty" [ref=e151] [cursor=pointer]
          - button "2L, n4, double letter, empty" [ref=e152] [cursor=pointer]:
            - generic [ref=e153]: 2L
          - button "o4, empty" [ref=e154] [cursor=pointer]
          - generic [ref=e155]: "5"
          - button "3W, a5, triple word, empty" [ref=e156] [cursor=pointer]:
            - generic [ref=e157]: 3W
          - button "b5, empty" [ref=e158] [cursor=pointer]
          - button "3L, c5, triple letter, empty" [ref=e159] [cursor=pointer]:
            - generic [ref=e160]: 3L
          - button "d5, empty" [ref=e161] [cursor=pointer]
          - button "e5, empty" [ref=e162] [cursor=pointer]
          - button "f5, empty" [ref=e163] [cursor=pointer]
          - button "2L, g5, double letter, empty" [ref=e164] [cursor=pointer]:
            - generic [ref=e165]: 2L
          - button "h5, empty" [ref=e166] [cursor=pointer]
          - button "2L, i5, double letter, empty" [ref=e167] [cursor=pointer]:
            - generic [ref=e168]: 2L
          - button "j5, empty" [ref=e169] [cursor=pointer]
          - button "k5, empty" [ref=e170] [cursor=pointer]
          - button "l5, empty" [ref=e171] [cursor=pointer]
          - button "3L, m5, triple letter, empty" [ref=e172] [cursor=pointer]:
            - generic [ref=e173]: 3L
          - button "n5, empty" [ref=e174] [cursor=pointer]
          - button "3W, o5, triple word, empty" [ref=e175] [cursor=pointer]:
            - generic [ref=e176]: 3W
          - generic [ref=e177]: "6"
          - button "a6, empty" [ref=e178] [cursor=pointer]
          - button "b6, empty" [ref=e179] [cursor=pointer]
          - button "c6, empty" [ref=e180] [cursor=pointer]
          - button "d6, empty" [ref=e181] [cursor=pointer]
          - button "e6, empty" [ref=e182] [cursor=pointer]
          - button "f6, empty" [ref=e183] [cursor=pointer]
          - button "g6, empty" [ref=e184] [cursor=pointer]
          - button "3L, h6, triple letter, empty" [ref=e185] [cursor=pointer]:
            - generic [ref=e186]: 3L
          - button "i6, empty" [ref=e187] [cursor=pointer]
          - button "j6, empty" [ref=e188] [cursor=pointer]
          - button "k6, empty" [ref=e189] [cursor=pointer]
          - button "l6, empty" [ref=e190] [cursor=pointer]
          - button "m6, empty" [ref=e191] [cursor=pointer]
          - button "n6, empty" [ref=e192] [cursor=pointer]
          - button "o6, empty" [ref=e193] [cursor=pointer]
          - generic [ref=e194]: "7"
          - button "a7, empty" [ref=e195] [cursor=pointer]
          - button "2W, b7, double word, empty" [ref=e196] [cursor=pointer]:
            - generic [ref=e197]: 2W
          - button "c7, empty" [ref=e198] [cursor=pointer]
          - button "d7, empty" [ref=e199] [cursor=pointer]
          - button "2L, e7, double letter, empty" [ref=e200] [cursor=pointer]:
            - generic [ref=e201]: 2L
          - button "f7, empty" [ref=e202] [cursor=pointer]
          - button "2L, g7, double letter, empty" [ref=e203] [cursor=pointer]:
            - generic [ref=e204]: 2L
          - button "h7, empty" [ref=e205] [cursor=pointer]
          - button "2L, i7, double letter, empty" [ref=e206] [cursor=pointer]:
            - generic [ref=e207]: 2L
          - button "j7, empty" [ref=e208] [cursor=pointer]
          - button "2L, k7, double letter, empty" [ref=e209] [cursor=pointer]:
            - generic [ref=e210]: 2L
          - button "l7, empty" [ref=e211] [cursor=pointer]
          - button "m7, empty" [ref=e212] [cursor=pointer]
          - button "2W, n7, double word, empty" [ref=e213] [cursor=pointer]:
            - generic [ref=e214]: 2W
          - button "o7, empty" [ref=e215] [cursor=pointer]
          - generic [ref=e216]: "8"
          - button "2L, a8, double letter, empty" [ref=e217] [cursor=pointer]:
            - generic [ref=e218]: 2L
          - button "b8, empty" [ref=e219] [cursor=pointer]
          - button "c8, empty" [ref=e220] [cursor=pointer]
          - button "d8, empty" [ref=e221] [cursor=pointer]
          - button "e8, empty" [ref=e222] [cursor=pointer]
          - button "3L, f8, triple letter, empty" [ref=e223] [cursor=pointer]:
            - generic [ref=e224]: 3L
          - button "C 3, g8, committed" [disabled] [ref=e225]:
            - generic [ref=e226]: C
            - generic [ref=e227]: "3"
          - button "A 1, h8, committed" [disabled] [ref=e228]:
            - generic [ref=e229]: A
            - generic [ref=e230]: "1"
          - button "T 1, i8, committed" [disabled] [ref=e231]:
            - generic [ref=e232]: T
            - generic [ref=e233]: "1"
          - button "S 0, j8, your tentative blank as S" [ref=e234] [cursor=pointer]:
            - generic [ref=e235]: S
            - generic [ref=e236]: "0"
          - button "k8, empty" [ref=e237] [cursor=pointer]
          - button "l8, empty" [ref=e238] [cursor=pointer]
          - button "m8, empty" [ref=e239] [cursor=pointer]
          - button "n8, empty" [ref=e240] [cursor=pointer]
          - button "2L, o8, double letter, empty" [ref=e241] [cursor=pointer]:
            - generic [ref=e242]: 2L
          - generic [ref=e243]: "9"
          - button "a9, empty" [ref=e244] [cursor=pointer]
          - button "2W, b9, double word, empty" [ref=e245] [cursor=pointer]:
            - generic [ref=e246]: 2W
          - button "c9, empty" [ref=e247] [cursor=pointer]
          - button "d9, empty" [ref=e248] [cursor=pointer]
          - button "2L, e9, double letter, empty" [ref=e249] [cursor=pointer]:
            - generic [ref=e250]: 2L
          - button "f9, empty" [ref=e251] [cursor=pointer]
          - button "2L, g9, double letter, empty" [ref=e252] [cursor=pointer]:
            - generic [ref=e253]: 2L
          - button "h9, empty" [ref=e254] [cursor=pointer]
          - button "O 1, i9, committed" [disabled] [ref=e255]:
            - generic [ref=e256]: O
            - generic [ref=e257]: "1"
          - button "j9, empty" [ref=e258] [cursor=pointer]
          - button "2L, k9, double letter, empty" [ref=e259] [cursor=pointer]:
            - generic [ref=e260]: 2L
          - button "l9, empty" [ref=e261] [cursor=pointer]
          - button "m9, empty" [ref=e262] [cursor=pointer]
          - button "2W, n9, double word, empty" [ref=e263] [cursor=pointer]:
            - generic [ref=e264]: 2W
          - button "o9, empty" [ref=e265] [cursor=pointer]
          - generic [ref=e266]: "10"
          - button "a10, empty" [ref=e267] [cursor=pointer]
          - button "b10, empty" [ref=e268] [cursor=pointer]
          - button "c10, empty" [ref=e269] [cursor=pointer]
          - button "d10, empty" [ref=e270] [cursor=pointer]
          - button "e10, empty" [ref=e271] [cursor=pointer]
          - button "f10, empty" [ref=e272] [cursor=pointer]
          - button "g10, empty" [ref=e273] [cursor=pointer]
          - button "3L, h10, triple letter, empty" [ref=e274] [cursor=pointer]:
            - generic [ref=e275]: 3L
          - button "E 1, i10, committed" [disabled] [ref=e276]:
            - generic [ref=e277]: E
            - generic [ref=e278]: "1"
          - button "j10, empty" [ref=e279] [cursor=pointer]
          - button "k10, empty" [ref=e280] [cursor=pointer]
          - button "l10, empty" [ref=e281] [cursor=pointer]
          - button "m10, empty" [ref=e282] [cursor=pointer]
          - button "n10, empty" [ref=e283] [cursor=pointer]
          - button "o10, empty" [ref=e284] [cursor=pointer]
          - generic [ref=e285]: "11"
          - button "3W, a11, triple word, empty" [ref=e286] [cursor=pointer]:
            - generic [ref=e287]: 3W
          - button "b11, empty" [ref=e288] [cursor=pointer]
          - button "3L, c11, triple letter, empty" [ref=e289] [cursor=pointer]:
            - generic [ref=e290]: 3L
          - button "d11, empty" [ref=e291] [cursor=pointer]
          - button "e11, empty" [ref=e292] [cursor=pointer]
          - button "f11, empty" [ref=e293] [cursor=pointer]
          - button "2L, g11, double letter, empty" [ref=e294] [cursor=pointer]:
            - generic [ref=e295]: 2L
          - button "h11, empty" [ref=e296] [cursor=pointer]
          - button "2L, i11, double letter, empty" [ref=e297] [cursor=pointer]:
            - generic [ref=e298]: 2L
          - button "j11, empty" [ref=e299] [cursor=pointer]
          - button "k11, empty" [ref=e300] [cursor=pointer]
          - button "l11, empty" [ref=e301] [cursor=pointer]
          - button "3L, m11, triple letter, empty" [ref=e302] [cursor=pointer]:
            - generic [ref=e303]: 3L
          - button "n11, empty" [ref=e304] [cursor=pointer]
          - button "3W, o11, triple word, empty" [ref=e305] [cursor=pointer]:
            - generic [ref=e306]: 3W
          - generic [ref=e307]: "12"
          - button "a12, empty" [ref=e308] [cursor=pointer]
          - button "2L, b12, double letter, empty" [ref=e309] [cursor=pointer]:
            - generic [ref=e310]: 2L
          - button "c12, empty" [ref=e311] [cursor=pointer]
          - button "2W, d12, double word, empty" [ref=e312] [cursor=pointer]:
            - generic [ref=e313]: 2W
          - button "e12, empty" [ref=e314] [cursor=pointer]
          - button "f12, empty" [ref=e315] [cursor=pointer]
          - button "g12, empty" [ref=e316] [cursor=pointer]
          - button "h12, empty" [ref=e317] [cursor=pointer]
          - button "i12, empty" [ref=e318] [cursor=pointer]
          - button "j12, empty" [ref=e319] [cursor=pointer]
          - button "k12, empty" [ref=e320] [cursor=pointer]
          - button "2W, l12, double word, empty" [ref=e321] [cursor=pointer]:
            - generic [ref=e322]: 2W
          - button "m12, empty" [ref=e323] [cursor=pointer]
          - button "2L, n12, double letter, empty" [ref=e324] [cursor=pointer]:
            - generic [ref=e325]: 2L
          - button "o12, empty" [ref=e326] [cursor=pointer]
          - generic [ref=e327]: "13"
          - button "a13, empty" [ref=e328] [cursor=pointer]
          - button "b13, empty" [ref=e329] [cursor=pointer]
          - button "c13, empty" [ref=e330] [cursor=pointer]
          - button "d13, empty" [ref=e331] [cursor=pointer]
          - button "3L, e13, triple letter, empty" [ref=e332] [cursor=pointer]:
            - generic [ref=e333]: 3L
          - button "f13, empty" [ref=e334] [cursor=pointer]
          - button "g13, empty" [ref=e335] [cursor=pointer]
          - button "h13, empty" [ref=e336] [cursor=pointer]
          - button "i13, empty" [ref=e337] [cursor=pointer]
          - button "j13, empty" [ref=e338] [cursor=pointer]
          - button "3L, k13, triple letter, empty" [ref=e339] [cursor=pointer]:
            - generic [ref=e340]: 3L
          - button "l13, empty" [ref=e341] [cursor=pointer]
          - button "m13, empty" [ref=e342] [cursor=pointer]
          - button "n13, empty" [ref=e343] [cursor=pointer]
          - button "o13, empty" [ref=e344] [cursor=pointer]
          - generic [ref=e345]: "14"
          - button "a14, empty" [ref=e346] [cursor=pointer]
          - button "b14, empty" [ref=e347] [cursor=pointer]
          - button "c14, empty" [ref=e348] [cursor=pointer]
          - button "2L, d14, double letter, empty" [ref=e349] [cursor=pointer]:
            - generic [ref=e350]: 2L
          - button "e14, empty" [ref=e351] [cursor=pointer]
          - button "f14, empty" [ref=e352] [cursor=pointer]
          - button "2W, g14, double word, empty" [ref=e353] [cursor=pointer]:
            - generic [ref=e354]: 2W
          - button "h14, empty" [ref=e355] [cursor=pointer]
          - button "2W, i14, double word, empty" [ref=e356] [cursor=pointer]:
            - generic [ref=e357]: 2W
          - button "j14, empty" [ref=e358] [cursor=pointer]
          - button "k14, empty" [ref=e359] [cursor=pointer]
          - button "2L, l14, double letter, empty" [ref=e360] [cursor=pointer]:
            - generic [ref=e361]: 2L
          - button "m14, empty" [ref=e362] [cursor=pointer]
          - button "n14, empty" [ref=e363] [cursor=pointer]
          - button "o14, empty" [ref=e364] [cursor=pointer]
          - generic [ref=e365]: "15"
          - button "2L, a15, double letter, empty" [ref=e366] [cursor=pointer]:
            - generic [ref=e367]: 2L
          - button "b15, empty" [ref=e368] [cursor=pointer]
          - button "c15, empty" [ref=e369] [cursor=pointer]
          - button "d15, empty" [ref=e370] [cursor=pointer]
          - button "3W, e15, triple word, empty" [ref=e371] [cursor=pointer]:
            - generic [ref=e372]: 3W
          - button "f15, empty" [ref=e373] [cursor=pointer]
          - button "g15, empty" [ref=e374] [cursor=pointer]
          - button "2L, h15, double letter, empty" [ref=e375] [cursor=pointer]:
            - generic [ref=e376]: 2L
          - button "i15, empty" [ref=e377] [cursor=pointer]
          - button "j15, empty" [ref=e378] [cursor=pointer]
          - button "3W, k15, triple word, empty" [ref=e379] [cursor=pointer]:
            - generic [ref=e380]: 3W
          - button "l15, empty" [ref=e381] [cursor=pointer]
          - button "m15, empty" [ref=e382] [cursor=pointer]
          - button "n15, empty" [ref=e383] [cursor=pointer]
          - button "2L, o15, double letter, empty" [ref=e384] [cursor=pointer]:
            - generic [ref=e385]: 2L
    - paragraph [ref=e386]: "Bonus squares: 2L doubles a letter, 3L triples a letter, 2W doubles the word, 3W triples the word."
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