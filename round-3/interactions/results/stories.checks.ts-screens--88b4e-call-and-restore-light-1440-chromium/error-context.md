# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--recall-and-restore light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/recall-and-restore-light-1440.png.
```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e15]:
    - generic [ref=e16]:
      - heading "Word Tiles" [level=1] [ref=e19]
      - generic [ref=e21]:
        - generic [ref=e22]: Unrated
        - generic [ref=e23]: ·Untimed
    - generic [ref=e25]:
      - generic [ref=e27]:
        - generic [ref=e29]:
          - generic [ref=e33]:
            - generic [ref=e34]:
              - img "Teal" [ref=e35]
              - generic [ref=e36]: jordan_plays
            - generic [ref=e39]: 7 tiles
          - generic [ref=e40]:
            - generic [ref=e41]: Score
            - generic [ref=e42]: "0"
        - generic [ref=e44]:
          - group "Your rack" [ref=e45]:
            - button "C, 3 points" [ref=e46] [cursor=pointer]:
              - generic [ref=e47]: C
              - generic [ref=e48]: "3"
            - button "A, 1 points" [ref=e49] [cursor=pointer]:
              - generic [ref=e50]: A
              - generic [ref=e51]: "1"
            - button "T, 1 points" [ref=e52] [cursor=pointer]:
              - generic [ref=e53]: T
              - generic [ref=e54]: "1"
            - button "Blank, 0 points" [ref=e55] [cursor=pointer]:
              - generic [ref=e56]: "0"
            - button "E, 1 points" [ref=e57] [cursor=pointer]:
              - generic [ref=e58]: E
              - generic [ref=e59]: "1"
            - button "S, 1 points" [ref=e60] [cursor=pointer]:
              - generic [ref=e61]: S
              - generic [ref=e62]: "1"
            - button "Q, 10 points" [ref=e63] [cursor=pointer]:
              - generic [ref=e64]: Q
              - generic [ref=e65]: "10"
          - generic [ref=e66]:
            - button "Play word" [disabled] [ref=e67]:
              - paragraph [ref=e70]: Play word
            - status [ref=e73]: Choose a tile, then a square.
          - generic [ref=e74]:
            - generic [ref=e75]:
              - button "Fit board" [pressed] [ref=e76] [cursor=pointer]:
                - paragraph [ref=e79]: Fit board
              - button "Enlarge board" [ref=e80] [cursor=pointer]:
                - paragraph [ref=e83]: Enlarge board
            - region "Scrollable word board" [ref=e84]:
              - group "Word board, fifteen columns and fifteen rows" [ref=e85]:
                - generic [ref=e87]: a
                - generic [ref=e88]: b
                - generic [ref=e89]: c
                - generic [ref=e90]: d
                - generic [ref=e91]: e
                - generic [ref=e92]: f
                - generic [ref=e93]: g
                - generic [ref=e94]: h
                - generic [ref=e95]: i
                - generic [ref=e96]: j
                - generic [ref=e97]: k
                - generic [ref=e98]: l
                - generic [ref=e99]: m
                - generic [ref=e100]: "n"
                - generic [ref=e101]: o
                - generic [ref=e102]: "1"
                - button "2L, a1, double letter, empty" [ref=e103] [cursor=pointer]:
                  - generic [ref=e104]: 2L
                - button "b1, empty" [ref=e105] [cursor=pointer]
                - button "c1, empty" [ref=e106] [cursor=pointer]
                - button "d1, empty" [ref=e107] [cursor=pointer]
                - button "3W, e1, triple word, empty" [ref=e108] [cursor=pointer]:
                  - generic [ref=e109]: 3W
                - button "f1, empty" [ref=e110] [cursor=pointer]
                - button "g1, empty" [ref=e111] [cursor=pointer]
                - button "2L, h1, double letter, empty" [ref=e112] [cursor=pointer]:
                  - generic [ref=e113]: 2L
                - button "i1, empty" [ref=e114] [cursor=pointer]
                - button "j1, empty" [ref=e115] [cursor=pointer]
                - button "3W, k1, triple word, empty" [ref=e116] [cursor=pointer]:
                  - generic [ref=e117]: 3W
                - button "l1, empty" [ref=e118] [cursor=pointer]
                - button "m1, empty" [ref=e119] [cursor=pointer]
                - button "n1, empty" [ref=e120] [cursor=pointer]
                - button "2L, o1, double letter, empty" [ref=e121] [cursor=pointer]:
                  - generic [ref=e122]: 2L
                - generic [ref=e123]: "2"
                - button "a2, empty" [ref=e124] [cursor=pointer]
                - button "b2, empty" [ref=e125] [cursor=pointer]
                - button "c2, empty" [ref=e126] [cursor=pointer]
                - button "2L, d2, double letter, empty" [ref=e127] [cursor=pointer]:
                  - generic [ref=e128]: 2L
                - button "e2, empty" [ref=e129] [cursor=pointer]
                - button "f2, empty" [ref=e130] [cursor=pointer]
                - button "2W, g2, double word, empty" [ref=e131] [cursor=pointer]:
                  - generic [ref=e132]: 2W
                - button "h2, empty" [ref=e133] [cursor=pointer]
                - button "2W, i2, double word, empty" [ref=e134] [cursor=pointer]:
                  - generic [ref=e135]: 2W
                - button "j2, empty" [ref=e136] [cursor=pointer]
                - button "k2, empty" [ref=e137] [cursor=pointer]
                - button "2L, l2, double letter, empty" [ref=e138] [cursor=pointer]:
                  - generic [ref=e139]: 2L
                - button "m2, empty" [ref=e140] [cursor=pointer]
                - button "n2, empty" [ref=e141] [cursor=pointer]
                - button "o2, empty" [ref=e142] [cursor=pointer]
                - generic [ref=e143]: "3"
                - button "a3, empty" [ref=e144] [cursor=pointer]
                - button "b3, empty" [ref=e145] [cursor=pointer]
                - button "c3, empty" [ref=e146] [cursor=pointer]
                - button "d3, empty" [ref=e147] [cursor=pointer]
                - button "3L, e3, triple letter, empty" [ref=e148] [cursor=pointer]:
                  - generic [ref=e149]: 3L
                - button "f3, empty" [ref=e150] [cursor=pointer]
                - button "g3, empty" [ref=e151] [cursor=pointer]
                - button "h3, empty" [ref=e152] [cursor=pointer]
                - button "i3, empty" [ref=e153] [cursor=pointer]
                - button "j3, empty" [ref=e154] [cursor=pointer]
                - button "3L, k3, triple letter, empty" [ref=e155] [cursor=pointer]:
                  - generic [ref=e156]: 3L
                - button "l3, empty" [ref=e157] [cursor=pointer]
                - button "m3, empty" [ref=e158] [cursor=pointer]
                - button "n3, empty" [ref=e159] [cursor=pointer]
                - button "o3, empty" [ref=e160] [cursor=pointer]
                - generic [ref=e161]: "4"
                - button "a4, empty" [ref=e162] [cursor=pointer]
                - button "2L, b4, double letter, empty" [ref=e163] [cursor=pointer]:
                  - generic [ref=e164]: 2L
                - button "c4, empty" [ref=e165] [cursor=pointer]
                - button "2W, d4, double word, empty" [ref=e166] [cursor=pointer]:
                  - generic [ref=e167]: 2W
                - button "e4, empty" [ref=e168] [cursor=pointer]
                - button "f4, empty" [ref=e169] [cursor=pointer]
                - button "g4, empty" [ref=e170] [cursor=pointer]
                - button "h4, empty" [ref=e171] [cursor=pointer]
                - button "i4, empty" [ref=e172] [cursor=pointer]
                - button "j4, empty" [ref=e173] [cursor=pointer]
                - button "k4, empty" [ref=e174] [cursor=pointer]
                - button "2W, l4, double word, empty" [ref=e175] [cursor=pointer]:
                  - generic [ref=e176]: 2W
                - button "m4, empty" [ref=e177] [cursor=pointer]
                - button "2L, n4, double letter, empty" [ref=e178] [cursor=pointer]:
                  - generic [ref=e179]: 2L
                - button "o4, empty" [ref=e180] [cursor=pointer]
                - generic [ref=e181]: "5"
                - button "3W, a5, triple word, empty" [ref=e182] [cursor=pointer]:
                  - generic [ref=e183]: 3W
                - button "b5, empty" [ref=e184] [cursor=pointer]
                - button "3L, c5, triple letter, empty" [ref=e185] [cursor=pointer]:
                  - generic [ref=e186]: 3L
                - button "d5, empty" [ref=e187] [cursor=pointer]
                - button "e5, empty" [ref=e188] [cursor=pointer]
                - button "f5, empty" [ref=e189] [cursor=pointer]
                - button "2L, g5, double letter, empty" [ref=e190] [cursor=pointer]:
                  - generic [ref=e191]: 2L
                - button "h5, empty" [ref=e192] [cursor=pointer]
                - button "2L, i5, double letter, empty" [ref=e193] [cursor=pointer]:
                  - generic [ref=e194]: 2L
                - button "j5, empty" [ref=e195] [cursor=pointer]
                - button "k5, empty" [ref=e196] [cursor=pointer]
                - button "l5, empty" [ref=e197] [cursor=pointer]
                - button "3L, m5, triple letter, empty" [ref=e198] [cursor=pointer]:
                  - generic [ref=e199]: 3L
                - button "n5, empty" [ref=e200] [cursor=pointer]
                - button "3W, o5, triple word, empty" [ref=e201] [cursor=pointer]:
                  - generic [ref=e202]: 3W
                - generic [ref=e203]: "6"
                - button "a6, empty" [ref=e204] [cursor=pointer]
                - button "b6, empty" [ref=e205] [cursor=pointer]
                - button "c6, empty" [ref=e206] [cursor=pointer]
                - button "d6, empty" [ref=e207] [cursor=pointer]
                - button "e6, empty" [ref=e208] [cursor=pointer]
                - button "f6, empty" [ref=e209] [cursor=pointer]
                - button "g6, empty" [ref=e210] [cursor=pointer]
                - button "3L, h6, triple letter, empty" [ref=e211] [cursor=pointer]:
                  - generic [ref=e212]: 3L
                - button "i6, empty" [ref=e213] [cursor=pointer]
                - button "j6, empty" [ref=e214] [cursor=pointer]
                - button "k6, empty" [ref=e215] [cursor=pointer]
                - button "l6, empty" [ref=e216] [cursor=pointer]
                - button "m6, empty" [ref=e217] [cursor=pointer]
                - button "n6, empty" [ref=e218] [cursor=pointer]
                - button "o6, empty" [ref=e219] [cursor=pointer]
                - generic [ref=e220]: "7"
                - button "a7, empty" [ref=e221] [cursor=pointer]
                - button "2W, b7, double word, empty" [ref=e222] [cursor=pointer]:
                  - generic [ref=e223]: 2W
                - button "c7, empty" [ref=e224] [cursor=pointer]
                - button "d7, empty" [ref=e225] [cursor=pointer]
                - button "2L, e7, double letter, empty" [ref=e226] [cursor=pointer]:
                  - generic [ref=e227]: 2L
                - button "f7, empty" [ref=e228] [cursor=pointer]
                - button "2L, g7, double letter, empty" [ref=e229] [cursor=pointer]:
                  - generic [ref=e230]: 2L
                - button "h7, empty" [ref=e231] [cursor=pointer]
                - button "2L, i7, double letter, empty" [ref=e232] [cursor=pointer]:
                  - generic [ref=e233]: 2L
                - button "j7, empty" [ref=e234] [cursor=pointer]
                - button "2L, k7, double letter, empty" [ref=e235] [cursor=pointer]:
                  - generic [ref=e236]: 2L
                - button "l7, empty" [ref=e237] [cursor=pointer]
                - button "m7, empty" [ref=e238] [cursor=pointer]
                - button "2W, n7, double word, empty" [ref=e239] [cursor=pointer]:
                  - generic [ref=e240]: 2W
                - button "o7, empty" [ref=e241] [cursor=pointer]
                - generic [ref=e242]: "8"
                - button "2L, a8, double letter, empty" [ref=e243] [cursor=pointer]:
                  - generic [ref=e244]: 2L
                - button "b8, empty" [ref=e245] [cursor=pointer]
                - button "c8, empty" [ref=e246] [cursor=pointer]
                - button "d8, empty" [ref=e247] [cursor=pointer]
                - button "e8, empty" [ref=e248] [cursor=pointer]
                - button "3L, f8, triple letter, empty" [ref=e249] [cursor=pointer]:
                  - generic [ref=e250]: 3L
                - button "g8, empty" [ref=e251] [cursor=pointer]
                - button "★, h8, start, double word, empty" [ref=e252] [cursor=pointer]:
                  - generic [ref=e253]: ★
                - button "i8, empty" [ref=e254] [cursor=pointer]
                - button "3L, j8, triple letter, empty" [ref=e255] [cursor=pointer]:
                  - generic [ref=e256]: 3L
                - button "k8, empty" [ref=e257] [cursor=pointer]
                - button "l8, empty" [ref=e258] [cursor=pointer]
                - button "m8, empty" [ref=e259] [cursor=pointer]
                - button "n8, empty" [ref=e260] [cursor=pointer]
                - button "2L, o8, double letter, empty" [ref=e261] [cursor=pointer]:
                  - generic [ref=e262]: 2L
                - generic [ref=e263]: "9"
                - button "a9, empty" [ref=e264] [cursor=pointer]
                - button "2W, b9, double word, empty" [ref=e265] [cursor=pointer]:
                  - generic [ref=e266]: 2W
                - button "c9, empty" [ref=e267] [cursor=pointer]
                - button "d9, empty" [ref=e268] [cursor=pointer]
                - button "2L, e9, double letter, empty" [ref=e269] [cursor=pointer]:
                  - generic [ref=e270]: 2L
                - button "f9, empty" [ref=e271] [cursor=pointer]
                - button "2L, g9, double letter, empty" [ref=e272] [cursor=pointer]:
                  - generic [ref=e273]: 2L
                - button "h9, empty" [ref=e274] [cursor=pointer]
                - button "2L, i9, double letter, empty" [ref=e275] [cursor=pointer]:
                  - generic [ref=e276]: 2L
                - button "j9, empty" [ref=e277] [cursor=pointer]
                - button "2L, k9, double letter, empty" [ref=e278] [cursor=pointer]:
                  - generic [ref=e279]: 2L
                - button "l9, empty" [ref=e280] [cursor=pointer]
                - button "m9, empty" [ref=e281] [cursor=pointer]
                - button "2W, n9, double word, empty" [ref=e282] [cursor=pointer]:
                  - generic [ref=e283]: 2W
                - button "o9, empty" [ref=e284] [cursor=pointer]
                - generic [ref=e285]: "10"
                - button "a10, empty" [ref=e286] [cursor=pointer]
                - button "b10, empty" [ref=e287] [cursor=pointer]
                - button "c10, empty" [ref=e288] [cursor=pointer]
                - button "d10, empty" [ref=e289] [cursor=pointer]
                - button "e10, empty" [ref=e290] [cursor=pointer]
                - button "f10, empty" [ref=e291] [cursor=pointer]
                - button "g10, empty" [ref=e292] [cursor=pointer]
                - button "3L, h10, triple letter, empty" [ref=e293] [cursor=pointer]:
                  - generic [ref=e294]: 3L
                - button "i10, empty" [ref=e295] [cursor=pointer]
                - button "j10, empty" [ref=e296] [cursor=pointer]
                - button "k10, empty" [ref=e297] [cursor=pointer]
                - button "l10, empty" [ref=e298] [cursor=pointer]
                - button "m10, empty" [ref=e299] [cursor=pointer]
                - button "n10, empty" [ref=e300] [cursor=pointer]
                - button "o10, empty" [ref=e301] [cursor=pointer]
                - generic [ref=e302]: "11"
                - button "3W, a11, triple word, empty" [ref=e303] [cursor=pointer]:
                  - generic [ref=e304]: 3W
                - button "b11, empty" [ref=e305] [cursor=pointer]
                - button "3L, c11, triple letter, empty" [ref=e306] [cursor=pointer]:
                  - generic [ref=e307]: 3L
                - button "d11, empty" [ref=e308] [cursor=pointer]
                - button "e11, empty" [ref=e309] [cursor=pointer]
                - button "f11, empty" [ref=e310] [cursor=pointer]
                - button "2L, g11, double letter, empty" [ref=e311] [cursor=pointer]:
                  - generic [ref=e312]: 2L
                - button "h11, empty" [ref=e313] [cursor=pointer]
                - button "2L, i11, double letter, empty" [ref=e314] [cursor=pointer]:
                  - generic [ref=e315]: 2L
                - button "j11, empty" [ref=e316] [cursor=pointer]
                - button "k11, empty" [ref=e317] [cursor=pointer]
                - button "l11, empty" [ref=e318] [cursor=pointer]
                - button "3L, m11, triple letter, empty" [ref=e319] [cursor=pointer]:
                  - generic [ref=e320]: 3L
                - button "n11, empty" [ref=e321] [cursor=pointer]
                - button "3W, o11, triple word, empty" [ref=e322] [cursor=pointer]:
                  - generic [ref=e323]: 3W
                - generic [ref=e324]: "12"
                - button "a12, empty" [ref=e325] [cursor=pointer]
                - button "2L, b12, double letter, empty" [ref=e326] [cursor=pointer]:
                  - generic [ref=e327]: 2L
                - button "c12, empty" [ref=e328] [cursor=pointer]
                - button "2W, d12, double word, empty" [ref=e329] [cursor=pointer]:
                  - generic [ref=e330]: 2W
                - button "e12, empty" [ref=e331] [cursor=pointer]
                - button "f12, empty" [ref=e332] [cursor=pointer]
                - button "g12, empty" [ref=e333] [cursor=pointer]
                - button "h12, empty" [ref=e334] [cursor=pointer]
                - button "i12, empty" [ref=e335] [cursor=pointer]
                - button "j12, empty" [ref=e336] [cursor=pointer]
                - button "k12, empty" [ref=e337] [cursor=pointer]
                - button "2W, l12, double word, empty" [ref=e338] [cursor=pointer]:
                  - generic [ref=e339]: 2W
                - button "m12, empty" [ref=e340] [cursor=pointer]
                - button "2L, n12, double letter, empty" [ref=e341] [cursor=pointer]:
                  - generic [ref=e342]: 2L
                - button "o12, empty" [ref=e343] [cursor=pointer]
                - generic [ref=e344]: "13"
                - button "a13, empty" [ref=e345] [cursor=pointer]
                - button "b13, empty" [ref=e346] [cursor=pointer]
                - button "c13, empty" [ref=e347] [cursor=pointer]
                - button "d13, empty" [ref=e348] [cursor=pointer]
                - button "3L, e13, triple letter, empty" [ref=e349] [cursor=pointer]:
                  - generic [ref=e350]: 3L
                - button "f13, empty" [ref=e351] [cursor=pointer]
                - button "g13, empty" [ref=e352] [cursor=pointer]
                - button "h13, empty" [ref=e353] [cursor=pointer]
                - button "i13, empty" [ref=e354] [cursor=pointer]
                - button "j13, empty" [ref=e355] [cursor=pointer]
                - button "3L, k13, triple letter, empty" [ref=e356] [cursor=pointer]:
                  - generic [ref=e357]: 3L
                - button "l13, empty" [ref=e358] [cursor=pointer]
                - button "m13, empty" [ref=e359] [cursor=pointer]
                - button "n13, empty" [ref=e360] [cursor=pointer]
                - button "o13, empty" [ref=e361] [cursor=pointer]
                - generic [ref=e362]: "14"
                - button "a14, empty" [ref=e363] [cursor=pointer]
                - button "b14, empty" [ref=e364] [cursor=pointer]
                - button "c14, empty" [ref=e365] [cursor=pointer]
                - button "2L, d14, double letter, empty" [ref=e366] [cursor=pointer]:
                  - generic [ref=e367]: 2L
                - button "e14, empty" [ref=e368] [cursor=pointer]
                - button "f14, empty" [ref=e369] [cursor=pointer]
                - button "2W, g14, double word, empty" [ref=e370] [cursor=pointer]:
                  - generic [ref=e371]: 2W
                - button "h14, empty" [ref=e372] [cursor=pointer]
                - button "2W, i14, double word, empty" [ref=e373] [cursor=pointer]:
                  - generic [ref=e374]: 2W
                - button "j14, empty" [ref=e375] [cursor=pointer]
                - button "k14, empty" [ref=e376] [cursor=pointer]
                - button "2L, l14, double letter, empty" [ref=e377] [cursor=pointer]:
                  - generic [ref=e378]: 2L
                - button "m14, empty" [ref=e379] [cursor=pointer]
                - button "n14, empty" [ref=e380] [cursor=pointer]
                - button "o14, empty" [ref=e381] [cursor=pointer]
                - generic [ref=e382]: "15"
                - button "2L, a15, double letter, empty" [ref=e383] [cursor=pointer]:
                  - generic [ref=e384]: 2L
                - button "b15, empty" [ref=e385] [cursor=pointer]
                - button "c15, empty" [ref=e386] [cursor=pointer]
                - button "d15, empty" [ref=e387] [cursor=pointer]
                - button "3W, e15, triple word, empty" [ref=e388] [cursor=pointer]:
                  - generic [ref=e389]: 3W
                - button "f15, empty" [ref=e390] [cursor=pointer]
                - button "g15, empty" [ref=e391] [cursor=pointer]
                - button "2L, h15, double letter, empty" [ref=e392] [cursor=pointer]:
                  - generic [ref=e393]: 2L
                - button "i15, empty" [ref=e394] [cursor=pointer]
                - button "j15, empty" [ref=e395] [cursor=pointer]
                - button "3W, k15, triple word, empty" [ref=e396] [cursor=pointer]:
                  - generic [ref=e397]: 3W
                - button "l15, empty" [ref=e398] [cursor=pointer]
                - button "m15, empty" [ref=e399] [cursor=pointer]
                - button "n15, empty" [ref=e400] [cursor=pointer]
                - button "2L, o15, double letter, empty" [ref=e401] [cursor=pointer]:
                  - generic [ref=e402]: 2L
        - status [ref=e404]:
          - generic [ref=e405]:
            - generic [ref=e406]: "Amber: avery. Teal: jordan_plays."
            - text: Amber — to play · 86 tiles in the bag
        - generic [ref=e409]:
          - generic [ref=e413]:
            - generic [ref=e414]:
              - img "Amber" [ref=e415]
              - generic [ref=e416]: avery
              - generic [ref=e417]: Your move
            - generic [ref=e420]: 7 tiles
          - generic [ref=e421]:
            - generic [ref=e422]: Score
            - generic [ref=e423]: "0"
      - region "Game record" [ref=e426]:
        - generic [ref=e427]:
          - heading "Game record" [level=2] [ref=e429]
          - paragraph [ref=e430]: Amber — to play · 86 tiles in the bag
        - generic [ref=e432]:
          - group "Game actions" [ref=e433]:
            - button "Recall tiles" [disabled] [ref=e434]:
              - paragraph [ref=e437]: Recall tiles
            - button "Undo" [ref=e438] [cursor=pointer]:
              - paragraph [ref=e441]: Undo
            - button "Redo" [disabled] [ref=e442]:
              - paragraph [ref=e445]: Redo
            - button "Shuffle rack" [ref=e446] [cursor=pointer]:
              - paragraph [ref=e449]: Shuffle rack
            - button "Pass" [ref=e450] [cursor=pointer]:
              - paragraph [ref=e453]: Pass
            - button "Exchange tiles" [ref=e454] [cursor=pointer]:
              - paragraph [ref=e457]: Exchange tiles
            - button "Offer draw" [ref=e458] [cursor=pointer]:
              - paragraph [ref=e461]: Offer draw
            - button "Resign game" [ref=e462] [cursor=pointer]:
              - paragraph [ref=e465]:
                - text: Resign
                - generic [ref=e466]: game
          - button "History and stats" [ref=e467] [cursor=pointer]:
            - paragraph [ref=e470]: History and stats
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
     |                                                 ^ Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/recall-and-restore-light-1440.png.
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```