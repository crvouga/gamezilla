# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--word-list-unavailable dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  111189 pixels (ratio 0.10 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/word-list-unavailable-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/word-list-unavailable-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 111189 pixels (ratio 0.10 of all image pixels) are different.
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
  - 111189 pixels (ratio 0.10 of all image pixels) are different.

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
              - generic "jordan_plays" [ref=e38]
            - generic [ref=e41]: 7 tiles
          - generic [ref=e42]:
            - generic [ref=e43]: Score
            - generic [ref=e44]: "0"
        - generic [ref=e46]:
          - status [ref=e47]: The word list could not load. Your draft is kept. Reload it to preview words, or play for the game to check them.
          - button "Load the word list again" [ref=e48] [cursor=pointer]:
            - paragraph [ref=e51]: Load the word list again
          - group "Your rack" [ref=e52]:
            - button "C, 3 points" [ref=e53] [cursor=pointer]:
              - generic [ref=e54]: C
              - generic [ref=e55]: "3"
            - button "A, 1 points" [ref=e56] [cursor=pointer]:
              - generic [ref=e57]: A
              - generic [ref=e58]: "1"
            - button "T, 1 points" [ref=e59] [cursor=pointer]:
              - generic [ref=e60]: T
              - generic [ref=e61]: "1"
            - button "Blank, 0 points" [ref=e62] [cursor=pointer]:
              - generic [ref=e63]: "0"
            - button "E, 1 points" [ref=e64] [cursor=pointer]:
              - generic [ref=e65]: E
              - generic [ref=e66]: "1"
            - button "S, 1 points" [ref=e67] [cursor=pointer]:
              - generic [ref=e68]: S
              - generic [ref=e69]: "1"
            - button "Q, 10 points" [ref=e70] [cursor=pointer]:
              - generic [ref=e71]: Q
              - generic [ref=e72]: "10"
          - generic [ref=e73]:
            - group "Word actions" [ref=e75]:
              - button "Play word" [disabled] [ref=e76]:
                - paragraph [ref=e79]: Play word
              - button "Pass, exchange & tools" [ref=e80] [cursor=pointer]:
                - paragraph [ref=e83]: Pass, exchange & tools
            - status [ref=e86]: Choose a tile, then a square.
          - generic [ref=e87]:
            - generic [ref=e88]:
              - button "Fit board" [pressed] [ref=e89] [cursor=pointer]:
                - paragraph [ref=e92]: Fit board
              - button "Enlarge board" [ref=e93] [cursor=pointer]:
                - paragraph [ref=e96]: Enlarge board
            - region "Scrollable word board" [ref=e98]:
              - group "Word board, fifteen columns and fifteen rows" [ref=e99]:
                - generic [ref=e101]: a
                - generic [ref=e102]: b
                - generic [ref=e103]: c
                - generic [ref=e104]: d
                - generic [ref=e105]: e
                - generic [ref=e106]: f
                - generic [ref=e107]: g
                - generic [ref=e108]: h
                - generic [ref=e109]: i
                - generic [ref=e110]: j
                - generic [ref=e111]: k
                - generic [ref=e112]: l
                - generic [ref=e113]: m
                - generic [ref=e114]: "n"
                - generic [ref=e115]: o
                - generic [ref=e116]: "1"
                - button "2L, a1, double letter, empty" [ref=e117] [cursor=pointer]:
                  - generic [ref=e118]: 2L
                - button "b1, empty" [ref=e119] [cursor=pointer]
                - button "c1, empty" [ref=e120] [cursor=pointer]
                - button "d1, empty" [ref=e121] [cursor=pointer]
                - button "3W, e1, triple word, empty" [ref=e122] [cursor=pointer]:
                  - generic [ref=e123]: 3W
                - button "f1, empty" [ref=e124] [cursor=pointer]
                - button "g1, empty" [ref=e125] [cursor=pointer]
                - button "2L, h1, double letter, empty" [ref=e126] [cursor=pointer]:
                  - generic [ref=e127]: 2L
                - button "i1, empty" [ref=e128] [cursor=pointer]
                - button "j1, empty" [ref=e129] [cursor=pointer]
                - button "3W, k1, triple word, empty" [ref=e130] [cursor=pointer]:
                  - generic [ref=e131]: 3W
                - button "l1, empty" [ref=e132] [cursor=pointer]
                - button "m1, empty" [ref=e133] [cursor=pointer]
                - button "n1, empty" [ref=e134] [cursor=pointer]
                - button "2L, o1, double letter, empty" [ref=e135] [cursor=pointer]:
                  - generic [ref=e136]: 2L
                - generic [ref=e137]: "2"
                - button "a2, empty" [ref=e138] [cursor=pointer]
                - button "b2, empty" [ref=e139] [cursor=pointer]
                - button "c2, empty" [ref=e140] [cursor=pointer]
                - button "2L, d2, double letter, empty" [ref=e141] [cursor=pointer]:
                  - generic [ref=e142]: 2L
                - button "e2, empty" [ref=e143] [cursor=pointer]
                - button "f2, empty" [ref=e144] [cursor=pointer]
                - button "2W, g2, double word, empty" [ref=e145] [cursor=pointer]:
                  - generic [ref=e146]: 2W
                - button "h2, empty" [ref=e147] [cursor=pointer]
                - button "2W, i2, double word, empty" [ref=e148] [cursor=pointer]:
                  - generic [ref=e149]: 2W
                - button "j2, empty" [ref=e150] [cursor=pointer]
                - button "k2, empty" [ref=e151] [cursor=pointer]
                - button "2L, l2, double letter, empty" [ref=e152] [cursor=pointer]:
                  - generic [ref=e153]: 2L
                - button "m2, empty" [ref=e154] [cursor=pointer]
                - button "n2, empty" [ref=e155] [cursor=pointer]
                - button "o2, empty" [ref=e156] [cursor=pointer]
                - generic [ref=e157]: "3"
                - button "a3, empty" [ref=e158] [cursor=pointer]
                - button "b3, empty" [ref=e159] [cursor=pointer]
                - button "c3, empty" [ref=e160] [cursor=pointer]
                - button "d3, empty" [ref=e161] [cursor=pointer]
                - button "3L, e3, triple letter, empty" [ref=e162] [cursor=pointer]:
                  - generic [ref=e163]: 3L
                - button "f3, empty" [ref=e164] [cursor=pointer]
                - button "g3, empty" [ref=e165] [cursor=pointer]
                - button "h3, empty" [ref=e166] [cursor=pointer]
                - button "i3, empty" [ref=e167] [cursor=pointer]
                - button "j3, empty" [ref=e168] [cursor=pointer]
                - button "3L, k3, triple letter, empty" [ref=e169] [cursor=pointer]:
                  - generic [ref=e170]: 3L
                - button "l3, empty" [ref=e171] [cursor=pointer]
                - button "m3, empty" [ref=e172] [cursor=pointer]
                - button "n3, empty" [ref=e173] [cursor=pointer]
                - button "o3, empty" [ref=e174] [cursor=pointer]
                - generic [ref=e175]: "4"
                - button "a4, empty" [ref=e176] [cursor=pointer]
                - button "2L, b4, double letter, empty" [ref=e177] [cursor=pointer]:
                  - generic [ref=e178]: 2L
                - button "c4, empty" [ref=e179] [cursor=pointer]
                - button "2W, d4, double word, empty" [ref=e180] [cursor=pointer]:
                  - generic [ref=e181]: 2W
                - button "e4, empty" [ref=e182] [cursor=pointer]
                - button "f4, empty" [ref=e183] [cursor=pointer]
                - button "g4, empty" [ref=e184] [cursor=pointer]
                - button "h4, empty" [ref=e185] [cursor=pointer]
                - button "i4, empty" [ref=e186] [cursor=pointer]
                - button "j4, empty" [ref=e187] [cursor=pointer]
                - button "k4, empty" [ref=e188] [cursor=pointer]
                - button "2W, l4, double word, empty" [ref=e189] [cursor=pointer]:
                  - generic [ref=e190]: 2W
                - button "m4, empty" [ref=e191] [cursor=pointer]
                - button "2L, n4, double letter, empty" [ref=e192] [cursor=pointer]:
                  - generic [ref=e193]: 2L
                - button "o4, empty" [ref=e194] [cursor=pointer]
                - generic [ref=e195]: "5"
                - button "3W, a5, triple word, empty" [ref=e196] [cursor=pointer]:
                  - generic [ref=e197]: 3W
                - button "b5, empty" [ref=e198] [cursor=pointer]
                - button "3L, c5, triple letter, empty" [ref=e199] [cursor=pointer]:
                  - generic [ref=e200]: 3L
                - button "d5, empty" [ref=e201] [cursor=pointer]
                - button "e5, empty" [ref=e202] [cursor=pointer]
                - button "f5, empty" [ref=e203] [cursor=pointer]
                - button "2L, g5, double letter, empty" [ref=e204] [cursor=pointer]:
                  - generic [ref=e205]: 2L
                - button "h5, empty" [ref=e206] [cursor=pointer]
                - button "2L, i5, double letter, empty" [ref=e207] [cursor=pointer]:
                  - generic [ref=e208]: 2L
                - button "j5, empty" [ref=e209] [cursor=pointer]
                - button "k5, empty" [ref=e210] [cursor=pointer]
                - button "l5, empty" [ref=e211] [cursor=pointer]
                - button "3L, m5, triple letter, empty" [ref=e212] [cursor=pointer]:
                  - generic [ref=e213]: 3L
                - button "n5, empty" [ref=e214] [cursor=pointer]
                - button "3W, o5, triple word, empty" [ref=e215] [cursor=pointer]:
                  - generic [ref=e216]: 3W
                - generic [ref=e217]: "6"
                - button "a6, empty" [ref=e218] [cursor=pointer]
                - button "b6, empty" [ref=e219] [cursor=pointer]
                - button "c6, empty" [ref=e220] [cursor=pointer]
                - button "d6, empty" [ref=e221] [cursor=pointer]
                - button "e6, empty" [ref=e222] [cursor=pointer]
                - button "f6, empty" [ref=e223] [cursor=pointer]
                - button "g6, empty" [ref=e224] [cursor=pointer]
                - button "3L, h6, triple letter, empty" [ref=e225] [cursor=pointer]:
                  - generic [ref=e226]: 3L
                - button "i6, empty" [ref=e227] [cursor=pointer]
                - button "j6, empty" [ref=e228] [cursor=pointer]
                - button "k6, empty" [ref=e229] [cursor=pointer]
                - button "l6, empty" [ref=e230] [cursor=pointer]
                - button "m6, empty" [ref=e231] [cursor=pointer]
                - button "n6, empty" [ref=e232] [cursor=pointer]
                - button "o6, empty" [ref=e233] [cursor=pointer]
                - generic [ref=e234]: "7"
                - button "a7, empty" [ref=e235] [cursor=pointer]
                - button "2W, b7, double word, empty" [ref=e236] [cursor=pointer]:
                  - generic [ref=e237]: 2W
                - button "c7, empty" [ref=e238] [cursor=pointer]
                - button "d7, empty" [ref=e239] [cursor=pointer]
                - button "2L, e7, double letter, empty" [ref=e240] [cursor=pointer]:
                  - generic [ref=e241]: 2L
                - button "f7, empty" [ref=e242] [cursor=pointer]
                - button "2L, g7, double letter, empty" [ref=e243] [cursor=pointer]:
                  - generic [ref=e244]: 2L
                - button "h7, empty" [ref=e245] [cursor=pointer]
                - button "2L, i7, double letter, empty" [ref=e246] [cursor=pointer]:
                  - generic [ref=e247]: 2L
                - button "j7, empty" [ref=e248] [cursor=pointer]
                - button "2L, k7, double letter, empty" [ref=e249] [cursor=pointer]:
                  - generic [ref=e250]: 2L
                - button "l7, empty" [ref=e251] [cursor=pointer]
                - button "m7, empty" [ref=e252] [cursor=pointer]
                - button "2W, n7, double word, empty" [ref=e253] [cursor=pointer]:
                  - generic [ref=e254]: 2W
                - button "o7, empty" [ref=e255] [cursor=pointer]
                - generic [ref=e256]: "8"
                - button "2L, a8, double letter, empty" [ref=e257] [cursor=pointer]:
                  - generic [ref=e258]: 2L
                - button "b8, empty" [ref=e259] [cursor=pointer]
                - button "c8, empty" [ref=e260] [cursor=pointer]
                - button "d8, empty" [ref=e261] [cursor=pointer]
                - button "e8, empty" [ref=e262] [cursor=pointer]
                - button "3L, f8, triple letter, empty" [ref=e263] [cursor=pointer]:
                  - generic [ref=e264]: 3L
                - button "g8, empty" [ref=e265] [cursor=pointer]
                - button "★, h8, start, double word, empty" [ref=e266] [cursor=pointer]:
                  - generic [ref=e267]: ★
                - button "i8, empty" [ref=e268] [cursor=pointer]
                - button "3L, j8, triple letter, empty" [ref=e269] [cursor=pointer]:
                  - generic [ref=e270]: 3L
                - button "k8, empty" [ref=e271] [cursor=pointer]
                - button "l8, empty" [ref=e272] [cursor=pointer]
                - button "m8, empty" [ref=e273] [cursor=pointer]
                - button "n8, empty" [ref=e274] [cursor=pointer]
                - button "2L, o8, double letter, empty" [ref=e275] [cursor=pointer]:
                  - generic [ref=e276]: 2L
                - generic [ref=e277]: "9"
                - button "a9, empty" [ref=e278] [cursor=pointer]
                - button "2W, b9, double word, empty" [ref=e279] [cursor=pointer]:
                  - generic [ref=e280]: 2W
                - button "c9, empty" [ref=e281] [cursor=pointer]
                - button "d9, empty" [ref=e282] [cursor=pointer]
                - button "2L, e9, double letter, empty" [ref=e283] [cursor=pointer]:
                  - generic [ref=e284]: 2L
                - button "f9, empty" [ref=e285] [cursor=pointer]
                - button "2L, g9, double letter, empty" [ref=e286] [cursor=pointer]:
                  - generic [ref=e287]: 2L
                - button "h9, empty" [ref=e288] [cursor=pointer]
                - button "2L, i9, double letter, empty" [ref=e289] [cursor=pointer]:
                  - generic [ref=e290]: 2L
                - button "j9, empty" [ref=e291] [cursor=pointer]
                - button "2L, k9, double letter, empty" [ref=e292] [cursor=pointer]:
                  - generic [ref=e293]: 2L
                - button "l9, empty" [ref=e294] [cursor=pointer]
                - button "m9, empty" [ref=e295] [cursor=pointer]
                - button "2W, n9, double word, empty" [ref=e296] [cursor=pointer]:
                  - generic [ref=e297]: 2W
                - button "o9, empty" [ref=e298] [cursor=pointer]
                - generic [ref=e299]: "10"
                - button "a10, empty" [ref=e300] [cursor=pointer]
                - button "b10, empty" [ref=e301] [cursor=pointer]
                - button "c10, empty" [ref=e302] [cursor=pointer]
                - button "d10, empty" [ref=e303] [cursor=pointer]
                - button "e10, empty" [ref=e304] [cursor=pointer]
                - button "f10, empty" [ref=e305] [cursor=pointer]
                - button "g10, empty" [ref=e306] [cursor=pointer]
                - button "3L, h10, triple letter, empty" [ref=e307] [cursor=pointer]:
                  - generic [ref=e308]: 3L
                - button "i10, empty" [ref=e309] [cursor=pointer]
                - button "j10, empty" [ref=e310] [cursor=pointer]
                - button "k10, empty" [ref=e311] [cursor=pointer]
                - button "l10, empty" [ref=e312] [cursor=pointer]
                - button "m10, empty" [ref=e313] [cursor=pointer]
                - button "n10, empty" [ref=e314] [cursor=pointer]
                - button "o10, empty" [ref=e315] [cursor=pointer]
                - generic [ref=e316]: "11"
                - button "3W, a11, triple word, empty" [ref=e317] [cursor=pointer]:
                  - generic [ref=e318]: 3W
                - button "b11, empty" [ref=e319] [cursor=pointer]
                - button "3L, c11, triple letter, empty" [ref=e320] [cursor=pointer]:
                  - generic [ref=e321]: 3L
                - button "d11, empty" [ref=e322] [cursor=pointer]
                - button "e11, empty" [ref=e323] [cursor=pointer]
                - button "f11, empty" [ref=e324] [cursor=pointer]
                - button "2L, g11, double letter, empty" [ref=e325] [cursor=pointer]:
                  - generic [ref=e326]: 2L
                - button "h11, empty" [ref=e327] [cursor=pointer]
                - button "2L, i11, double letter, empty" [ref=e328] [cursor=pointer]:
                  - generic [ref=e329]: 2L
                - button "j11, empty" [ref=e330] [cursor=pointer]
                - button "k11, empty" [ref=e331] [cursor=pointer]
                - button "l11, empty" [ref=e332] [cursor=pointer]
                - button "3L, m11, triple letter, empty" [ref=e333] [cursor=pointer]:
                  - generic [ref=e334]: 3L
                - button "n11, empty" [ref=e335] [cursor=pointer]
                - button "3W, o11, triple word, empty" [ref=e336] [cursor=pointer]:
                  - generic [ref=e337]: 3W
                - generic [ref=e338]: "12"
                - button "a12, empty" [ref=e339] [cursor=pointer]
                - button "2L, b12, double letter, empty" [ref=e340] [cursor=pointer]:
                  - generic [ref=e341]: 2L
                - button "c12, empty" [ref=e342] [cursor=pointer]
                - button "2W, d12, double word, empty" [ref=e343] [cursor=pointer]:
                  - generic [ref=e344]: 2W
                - button "e12, empty" [ref=e345] [cursor=pointer]
                - button "f12, empty" [ref=e346] [cursor=pointer]
                - button "g12, empty" [ref=e347] [cursor=pointer]
                - button "h12, empty" [ref=e348] [cursor=pointer]
                - button "i12, empty" [ref=e349] [cursor=pointer]
                - button "j12, empty" [ref=e350] [cursor=pointer]
                - button "k12, empty" [ref=e351] [cursor=pointer]
                - button "2W, l12, double word, empty" [ref=e352] [cursor=pointer]:
                  - generic [ref=e353]: 2W
                - button "m12, empty" [ref=e354] [cursor=pointer]
                - button "2L, n12, double letter, empty" [ref=e355] [cursor=pointer]:
                  - generic [ref=e356]: 2L
                - button "o12, empty" [ref=e357] [cursor=pointer]
                - generic [ref=e358]: "13"
                - button "a13, empty" [ref=e359] [cursor=pointer]
                - button "b13, empty" [ref=e360] [cursor=pointer]
                - button "c13, empty" [ref=e361] [cursor=pointer]
                - button "d13, empty" [ref=e362] [cursor=pointer]
                - button "3L, e13, triple letter, empty" [ref=e363] [cursor=pointer]:
                  - generic [ref=e364]: 3L
                - button "f13, empty" [ref=e365] [cursor=pointer]
                - button "g13, empty" [ref=e366] [cursor=pointer]
                - button "h13, empty" [ref=e367] [cursor=pointer]
                - button "i13, empty" [ref=e368] [cursor=pointer]
                - button "j13, empty" [ref=e369] [cursor=pointer]
                - button "3L, k13, triple letter, empty" [ref=e370] [cursor=pointer]:
                  - generic [ref=e371]: 3L
                - button "l13, empty" [ref=e372] [cursor=pointer]
                - button "m13, empty" [ref=e373] [cursor=pointer]
                - button "n13, empty" [ref=e374] [cursor=pointer]
                - button "o13, empty" [ref=e375] [cursor=pointer]
                - generic [ref=e376]: "14"
                - button "a14, empty" [ref=e377] [cursor=pointer]
                - button "b14, empty" [ref=e378] [cursor=pointer]
                - button "c14, empty" [ref=e379] [cursor=pointer]
                - button "2L, d14, double letter, empty" [ref=e380] [cursor=pointer]:
                  - generic [ref=e381]: 2L
                - button "e14, empty" [ref=e382] [cursor=pointer]
                - button "f14, empty" [ref=e383] [cursor=pointer]
                - button "2W, g14, double word, empty" [ref=e384] [cursor=pointer]:
                  - generic [ref=e385]: 2W
                - button "h14, empty" [ref=e386] [cursor=pointer]
                - button "2W, i14, double word, empty" [ref=e387] [cursor=pointer]:
                  - generic [ref=e388]: 2W
                - button "j14, empty" [ref=e389] [cursor=pointer]
                - button "k14, empty" [ref=e390] [cursor=pointer]
                - button "2L, l14, double letter, empty" [ref=e391] [cursor=pointer]:
                  - generic [ref=e392]: 2L
                - button "m14, empty" [ref=e393] [cursor=pointer]
                - button "n14, empty" [ref=e394] [cursor=pointer]
                - button "o14, empty" [ref=e395] [cursor=pointer]
                - generic [ref=e396]: "15"
                - button "2L, a15, double letter, empty" [ref=e397] [cursor=pointer]:
                  - generic [ref=e398]: 2L
                - button "b15, empty" [ref=e399] [cursor=pointer]
                - button "c15, empty" [ref=e400] [cursor=pointer]
                - button "d15, empty" [ref=e401] [cursor=pointer]
                - button "3W, e15, triple word, empty" [ref=e402] [cursor=pointer]:
                  - generic [ref=e403]: 3W
                - button "f15, empty" [ref=e404] [cursor=pointer]
                - button "g15, empty" [ref=e405] [cursor=pointer]
                - button "2L, h15, double letter, empty" [ref=e406] [cursor=pointer]:
                  - generic [ref=e407]: 2L
                - button "i15, empty" [ref=e408] [cursor=pointer]
                - button "j15, empty" [ref=e409] [cursor=pointer]
                - button "3W, k15, triple word, empty" [ref=e410] [cursor=pointer]:
                  - generic [ref=e411]: 3W
                - button "l15, empty" [ref=e412] [cursor=pointer]
                - button "m15, empty" [ref=e413] [cursor=pointer]
                - button "n15, empty" [ref=e414] [cursor=pointer]
                - button "2L, o15, double letter, empty" [ref=e415] [cursor=pointer]:
                  - generic [ref=e416]: 2L
        - status [ref=e418]:
          - generic [ref=e419]:
            - generic [ref=e420]: "Amber: avery. Teal: jordan_plays."
            - text: Amber — to play · 86 tiles in the bag
        - generic [ref=e423]:
          - generic [ref=e427]:
            - generic [ref=e428]:
              - img "Amber" [ref=e429]
              - generic "avery" [ref=e432]
              - generic [ref=e433]: Your move
            - generic [ref=e436]: 7 tiles
          - generic [ref=e437]:
            - generic [ref=e438]: Score
            - generic [ref=e439]: "0"
      - region "Game record" [ref=e442]:
        - generic [ref=e443]:
          - heading "Game record" [level=2] [ref=e445]
          - paragraph [ref=e446]: Amber — to play · 86 tiles in the bag
        - generic [ref=e448]:
          - group "Game actions" [ref=e449]:
            - button "Offer draw" [ref=e450] [cursor=pointer]:
              - paragraph [ref=e453]: Offer draw
            - button "Resign game" [ref=e454] [cursor=pointer]:
              - paragraph [ref=e457]:
                - text: Resign
                - generic [ref=e458]: game
          - button "History and stats" [ref=e459] [cursor=pointer]:
            - paragraph [ref=e462]: History and stats
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