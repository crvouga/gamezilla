# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: word-tiles-round-five.checks.ts >> screens-games-word-tiles-puzzle--enlarged-blank regression word-tiles-cramped-precision-window
- Location: tests/storybook/word-tiles-round-five.checks.ts:35:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "success"
Received: "error: expected 43 to be less than or equal to 42"

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e10]:
    - paragraph [ref=e11]: Score at least 20 points in one move.
    - generic [ref=e12]:
      - paragraph [ref=e13]: Choose the letter your blank plays
      - group "Choose the letter your blank plays" [ref=e14]:
        - button "A" [active] [ref=e15] [cursor=pointer]:
          - paragraph [ref=e18]: A
        - button "B" [ref=e19] [cursor=pointer]:
          - paragraph [ref=e22]: B
        - button "C" [ref=e23] [cursor=pointer]:
          - paragraph [ref=e26]: C
        - button "D" [ref=e27] [cursor=pointer]:
          - paragraph [ref=e30]: D
        - button "E" [ref=e31] [cursor=pointer]:
          - paragraph [ref=e34]: E
        - button "F" [ref=e35] [cursor=pointer]:
          - paragraph [ref=e38]: F
        - button "G" [ref=e39] [cursor=pointer]:
          - paragraph [ref=e42]: G
        - button "H" [ref=e43] [cursor=pointer]:
          - paragraph [ref=e46]: H
        - button "I" [ref=e47] [cursor=pointer]:
          - paragraph [ref=e50]: I
        - button "J" [ref=e51] [cursor=pointer]:
          - paragraph [ref=e54]: J
        - button "K" [ref=e55] [cursor=pointer]:
          - paragraph [ref=e58]: K
        - button "L" [ref=e59] [cursor=pointer]:
          - paragraph [ref=e62]: L
        - button "M" [ref=e63] [cursor=pointer]:
          - paragraph [ref=e66]: M
        - button "N" [ref=e67] [cursor=pointer]:
          - paragraph [ref=e70]: "N"
        - button "O" [ref=e71] [cursor=pointer]:
          - paragraph [ref=e74]: O
        - button "P" [ref=e75] [cursor=pointer]:
          - paragraph [ref=e78]: P
        - button "Q" [ref=e79] [cursor=pointer]:
          - paragraph [ref=e82]: Q
        - button "R" [ref=e83] [cursor=pointer]:
          - paragraph [ref=e86]: R
        - button "S" [ref=e87] [cursor=pointer]:
          - paragraph [ref=e90]: S
        - button "T" [ref=e91] [cursor=pointer]:
          - paragraph [ref=e94]: T
        - button "U" [ref=e95] [cursor=pointer]:
          - paragraph [ref=e98]: U
        - button "V" [ref=e99] [cursor=pointer]:
          - paragraph [ref=e102]: V
        - button "W" [ref=e103] [cursor=pointer]:
          - paragraph [ref=e106]: W
        - button "X" [ref=e107] [cursor=pointer]:
          - paragraph [ref=e110]: X
        - button "Y" [ref=e111] [cursor=pointer]:
          - paragraph [ref=e114]: "Y"
        - button "Z" [ref=e115] [cursor=pointer]:
          - paragraph [ref=e118]: Z
    - status [ref=e120]: Choose the letter your blank plays.
    - generic [ref=e121]:
      - button "Play word" [disabled] [ref=e122]:
        - paragraph [ref=e125]: Play word
      - button "Recall tiles" [ref=e126] [cursor=pointer]:
        - paragraph [ref=e129]: Recall tiles
    - group "Your rack" [ref=e130]:
      - button "A, 1 points" [ref=e131] [cursor=pointer]:
        - generic [ref=e132]: A
        - generic [ref=e133]: "1"
      - button "E, 1 points" [ref=e134] [cursor=pointer]:
        - generic [ref=e135]: E
        - generic [ref=e136]: "1"
      - button "S, 1 points" [ref=e137] [cursor=pointer]:
        - generic [ref=e138]: S
        - generic [ref=e139]: "1"
      - button "T, 1 points" [ref=e140] [cursor=pointer]:
        - generic [ref=e141]: T
        - generic [ref=e142]: "1"
      - button "Blank, 0 points, on the board" [disabled] [ref=e143]
      - button "R, 1 points" [ref=e144] [cursor=pointer]:
        - generic [ref=e145]: R
        - generic [ref=e146]: "1"
      - button "N, 1 points" [ref=e147] [cursor=pointer]:
        - generic [ref=e148]: "N"
        - generic [ref=e149]: "1"
    - paragraph [ref=e150]: "j8: 3L triples this letter. Blank tiles score 0."
    - generic [ref=e151]:
      - generic [ref=e152]:
        - button "Fit board" [ref=e153] [cursor=pointer]:
          - paragraph [ref=e156]: Fit board
        - button "Enlarge board" [pressed] [ref=e157] [cursor=pointer]:
          - paragraph [ref=e160]: Enlarge board
      - paragraph [ref=e161]: Scroll or use arrow keys. Map locates squares; Enter places a tile.
      - generic [ref=e162]:
        - region "Scrollable word board" [ref=e163]:
          - group "Puzzle board, fifteen columns and fifteen rows" [ref=e164]:
            - generic [ref=e166]: a
            - generic [ref=e167]: b
            - generic [ref=e168]: c
            - generic [ref=e169]: d
            - generic [ref=e170]: e
            - generic [ref=e171]: f
            - generic [ref=e172]: g
            - generic [ref=e173]: h
            - generic [ref=e174]: i
            - generic [ref=e175]: j
            - generic [ref=e176]: k
            - generic [ref=e177]: l
            - generic [ref=e178]: m
            - generic [ref=e179]: "n"
            - generic [ref=e180]: o
            - generic [ref=e181]: "1"
            - button "2L, a1, double letter, empty" [ref=e182] [cursor=pointer]:
              - generic [ref=e183]: 2L
            - button "b1, empty" [ref=e184] [cursor=pointer]
            - button "c1, empty" [ref=e185] [cursor=pointer]
            - button "d1, empty" [ref=e186] [cursor=pointer]
            - button "3W, e1, triple word, empty" [ref=e187] [cursor=pointer]:
              - generic [ref=e188]: 3W
            - button "f1, empty" [ref=e189] [cursor=pointer]
            - button "g1, empty" [ref=e190] [cursor=pointer]
            - button "2L, h1, double letter, empty" [ref=e191] [cursor=pointer]:
              - generic [ref=e192]: 2L
            - button "i1, empty" [ref=e193] [cursor=pointer]
            - button "j1, empty" [ref=e194] [cursor=pointer]
            - button "3W, k1, triple word, empty" [ref=e195] [cursor=pointer]:
              - generic [ref=e196]: 3W
            - button "l1, empty" [ref=e197] [cursor=pointer]
            - button "m1, empty" [ref=e198] [cursor=pointer]
            - button "n1, empty" [ref=e199] [cursor=pointer]
            - button "2L, o1, double letter, empty" [ref=e200] [cursor=pointer]:
              - generic [ref=e201]: 2L
            - generic [ref=e202]: "2"
            - button "a2, empty" [ref=e203] [cursor=pointer]
            - button "b2, empty" [ref=e204] [cursor=pointer]
            - button "c2, empty" [ref=e205] [cursor=pointer]
            - button "2L, d2, double letter, empty" [ref=e206] [cursor=pointer]:
              - generic [ref=e207]: 2L
            - button "e2, empty" [ref=e208] [cursor=pointer]
            - button "f2, empty" [ref=e209] [cursor=pointer]
            - button "2W, g2, double word, empty" [ref=e210] [cursor=pointer]:
              - generic [ref=e211]: 2W
            - button "h2, empty" [ref=e212] [cursor=pointer]
            - button "2W, i2, double word, empty" [ref=e213] [cursor=pointer]:
              - generic [ref=e214]: 2W
            - button "j2, empty" [ref=e215] [cursor=pointer]
            - button "k2, empty" [ref=e216] [cursor=pointer]
            - button "2L, l2, double letter, empty" [ref=e217] [cursor=pointer]:
              - generic [ref=e218]: 2L
            - button "m2, empty" [ref=e219] [cursor=pointer]
            - button "n2, empty" [ref=e220] [cursor=pointer]
            - button "o2, empty" [ref=e221] [cursor=pointer]
            - generic [ref=e222]: "3"
            - button "a3, empty" [ref=e223] [cursor=pointer]
            - button "b3, empty" [ref=e224] [cursor=pointer]
            - button "c3, empty" [ref=e225] [cursor=pointer]
            - button "d3, empty" [ref=e226] [cursor=pointer]
            - button "3L, e3, triple letter, empty" [ref=e227] [cursor=pointer]:
              - generic [ref=e228]: 3L
            - button "f3, empty" [ref=e229] [cursor=pointer]
            - button "g3, empty" [ref=e230] [cursor=pointer]
            - button "h3, empty" [ref=e231] [cursor=pointer]
            - button "i3, empty" [ref=e232] [cursor=pointer]
            - button "j3, empty" [ref=e233] [cursor=pointer]
            - button "3L, k3, triple letter, empty" [ref=e234] [cursor=pointer]:
              - generic [ref=e235]: 3L
            - button "l3, empty" [ref=e236] [cursor=pointer]
            - button "m3, empty" [ref=e237] [cursor=pointer]
            - button "n3, empty" [ref=e238] [cursor=pointer]
            - button "o3, empty" [ref=e239] [cursor=pointer]
            - generic [ref=e240]: "4"
            - button "a4, empty" [ref=e241] [cursor=pointer]
            - button "2L, b4, double letter, empty" [ref=e242] [cursor=pointer]:
              - generic [ref=e243]: 2L
            - button "c4, empty" [ref=e244] [cursor=pointer]
            - button "2W, d4, double word, empty" [ref=e245] [cursor=pointer]:
              - generic [ref=e246]: 2W
            - button "e4, empty" [ref=e247] [cursor=pointer]
            - button "f4, empty" [ref=e248] [cursor=pointer]
            - button "g4, empty" [ref=e249] [cursor=pointer]
            - button "h4, empty" [ref=e250] [cursor=pointer]
            - button "i4, empty" [ref=e251] [cursor=pointer]
            - button "j4, empty" [ref=e252] [cursor=pointer]
            - button "k4, empty" [ref=e253] [cursor=pointer]
            - button "2W, l4, double word, empty" [ref=e254] [cursor=pointer]:
              - generic [ref=e255]: 2W
            - button "m4, empty" [ref=e256] [cursor=pointer]
            - button "2L, n4, double letter, empty" [ref=e257] [cursor=pointer]:
              - generic [ref=e258]: 2L
            - button "o4, empty" [ref=e259] [cursor=pointer]
            - generic [ref=e260]: "5"
            - button "3W, a5, triple word, empty" [ref=e261] [cursor=pointer]:
              - generic [ref=e262]: 3W
            - button "b5, empty" [ref=e263] [cursor=pointer]
            - button "3L, c5, triple letter, empty" [ref=e264] [cursor=pointer]:
              - generic [ref=e265]: 3L
            - button "d5, empty" [ref=e266] [cursor=pointer]
            - button "e5, empty" [ref=e267] [cursor=pointer]
            - button "f5, empty" [ref=e268] [cursor=pointer]
            - button "2L, g5, double letter, empty" [ref=e269] [cursor=pointer]:
              - generic [ref=e270]: 2L
            - button "h5, empty" [ref=e271] [cursor=pointer]
            - button "2L, i5, double letter, empty" [ref=e272] [cursor=pointer]:
              - generic [ref=e273]: 2L
            - button "j5, empty" [ref=e274] [cursor=pointer]
            - button "k5, empty" [ref=e275] [cursor=pointer]
            - button "l5, empty" [ref=e276] [cursor=pointer]
            - button "3L, m5, triple letter, empty" [ref=e277] [cursor=pointer]:
              - generic [ref=e278]: 3L
            - button "n5, empty" [ref=e279] [cursor=pointer]
            - button "3W, o5, triple word, empty" [ref=e280] [cursor=pointer]:
              - generic [ref=e281]: 3W
            - generic [ref=e282]: "6"
            - button "a6, empty" [ref=e283] [cursor=pointer]
            - button "b6, empty" [ref=e284] [cursor=pointer]
            - button "c6, empty" [ref=e285] [cursor=pointer]
            - button "d6, empty" [ref=e286] [cursor=pointer]
            - button "e6, empty" [ref=e287] [cursor=pointer]
            - button "f6, empty" [ref=e288] [cursor=pointer]
            - button "g6, empty" [ref=e289] [cursor=pointer]
            - button "3L, h6, triple letter, empty" [ref=e290] [cursor=pointer]:
              - generic [ref=e291]: 3L
            - button "i6, empty" [ref=e292] [cursor=pointer]
            - button "j6, empty" [ref=e293] [cursor=pointer]
            - button "k6, empty" [ref=e294] [cursor=pointer]
            - button "l6, empty" [ref=e295] [cursor=pointer]
            - button "m6, empty" [ref=e296] [cursor=pointer]
            - button "n6, empty" [ref=e297] [cursor=pointer]
            - button "o6, empty" [ref=e298] [cursor=pointer]
            - generic [ref=e299]: "7"
            - button "a7, empty" [ref=e300] [cursor=pointer]
            - button "2W, b7, double word, empty" [ref=e301] [cursor=pointer]:
              - generic [ref=e302]: 2W
            - button "c7, empty" [ref=e303] [cursor=pointer]
            - button "d7, empty" [ref=e304] [cursor=pointer]
            - button "2L, e7, double letter, empty" [ref=e305] [cursor=pointer]:
              - generic [ref=e306]: 2L
            - button "f7, empty" [ref=e307] [cursor=pointer]
            - button "2L, g7, double letter, empty" [ref=e308] [cursor=pointer]:
              - generic [ref=e309]: 2L
            - button "h7, empty" [ref=e310] [cursor=pointer]
            - button "2L, i7, double letter, empty" [ref=e311] [cursor=pointer]:
              - generic [ref=e312]: 2L
            - button "j7, empty" [ref=e313] [cursor=pointer]
            - button "2L, k7, double letter, empty" [ref=e314] [cursor=pointer]:
              - generic [ref=e315]: 2L
            - button "l7, empty" [ref=e316] [cursor=pointer]
            - button "m7, empty" [ref=e317] [cursor=pointer]
            - button "2W, n7, double word, empty" [ref=e318] [cursor=pointer]:
              - generic [ref=e319]: 2W
            - button "o7, empty" [ref=e320] [cursor=pointer]
            - generic [ref=e321]: "8"
            - button "2L, a8, double letter, empty" [ref=e322] [cursor=pointer]:
              - generic [ref=e323]: 2L
            - button "b8, empty" [ref=e324] [cursor=pointer]
            - button "c8, empty" [ref=e325] [cursor=pointer]
            - button "d8, empty" [ref=e326] [cursor=pointer]
            - button "e8, empty" [ref=e327] [cursor=pointer]
            - button "3L, f8, triple letter, empty" [ref=e328] [cursor=pointer]:
              - generic [ref=e329]: 3L
            - button "C 3, g8, committed" [disabled] [ref=e330]:
              - generic [ref=e331]: C
              - generic [ref=e332]: "3"
            - button "A 1, h8, committed" [disabled] [ref=e333]:
              - generic [ref=e334]: A
              - generic [ref=e335]: "1"
            - button "T 1, i8, committed" [disabled] [ref=e336]:
              - generic [ref=e337]: T
              - generic [ref=e338]: "1"
            - button "A 0, j8, your tentative blank as A" [ref=e339] [cursor=pointer]:
              - generic [ref=e340]: A
              - generic [ref=e341]: "0"
            - button "k8, empty" [ref=e342] [cursor=pointer]
            - button "l8, empty" [ref=e343] [cursor=pointer]
            - button "m8, empty" [ref=e344] [cursor=pointer]
            - button "n8, empty" [ref=e345] [cursor=pointer]
            - button "2L, o8, double letter, empty" [ref=e346] [cursor=pointer]:
              - generic [ref=e347]: 2L
            - generic [ref=e348]: "9"
            - button "a9, empty" [ref=e349] [cursor=pointer]
            - button "2W, b9, double word, empty" [ref=e350] [cursor=pointer]:
              - generic [ref=e351]: 2W
            - button "c9, empty" [ref=e352] [cursor=pointer]
            - button "d9, empty" [ref=e353] [cursor=pointer]
            - button "2L, e9, double letter, empty" [ref=e354] [cursor=pointer]:
              - generic [ref=e355]: 2L
            - button "f9, empty" [ref=e356] [cursor=pointer]
            - button "2L, g9, double letter, empty" [ref=e357] [cursor=pointer]:
              - generic [ref=e358]: 2L
            - button "h9, empty" [ref=e359] [cursor=pointer]
            - button "O 1, i9, committed" [disabled] [ref=e360]:
              - generic [ref=e361]: O
              - generic [ref=e362]: "1"
            - button "j9, empty" [ref=e363] [cursor=pointer]
            - button "2L, k9, double letter, empty" [ref=e364] [cursor=pointer]:
              - generic [ref=e365]: 2L
            - button "l9, empty" [ref=e366] [cursor=pointer]
            - button "m9, empty" [ref=e367] [cursor=pointer]
            - button "2W, n9, double word, empty" [ref=e368] [cursor=pointer]:
              - generic [ref=e369]: 2W
            - button "o9, empty" [ref=e370] [cursor=pointer]
            - generic [ref=e371]: "10"
            - button "a10, empty" [ref=e372] [cursor=pointer]
            - button "b10, empty" [ref=e373] [cursor=pointer]
            - button "c10, empty" [ref=e374] [cursor=pointer]
            - button "d10, empty" [ref=e375] [cursor=pointer]
            - button "e10, empty" [ref=e376] [cursor=pointer]
            - button "f10, empty" [ref=e377] [cursor=pointer]
            - button "g10, empty" [ref=e378] [cursor=pointer]
            - button "3L, h10, triple letter, empty" [ref=e379] [cursor=pointer]:
              - generic [ref=e380]: 3L
            - button "E 1, i10, committed" [disabled] [ref=e381]:
              - generic [ref=e382]: E
              - generic [ref=e383]: "1"
            - button "j10, empty" [ref=e384] [cursor=pointer]
            - button "k10, empty" [ref=e385] [cursor=pointer]
            - button "l10, empty" [ref=e386] [cursor=pointer]
            - button "m10, empty" [ref=e387] [cursor=pointer]
            - button "n10, empty" [ref=e388] [cursor=pointer]
            - button "o10, empty" [ref=e389] [cursor=pointer]
            - generic [ref=e390]: "11"
            - button "3W, a11, triple word, empty" [ref=e391] [cursor=pointer]:
              - generic [ref=e392]: 3W
            - button "b11, empty" [ref=e393] [cursor=pointer]
            - button "3L, c11, triple letter, empty" [ref=e394] [cursor=pointer]:
              - generic [ref=e395]: 3L
            - button "d11, empty" [ref=e396] [cursor=pointer]
            - button "e11, empty" [ref=e397] [cursor=pointer]
            - button "f11, empty" [ref=e398] [cursor=pointer]
            - button "2L, g11, double letter, empty" [ref=e399] [cursor=pointer]:
              - generic [ref=e400]: 2L
            - button "h11, empty" [ref=e401] [cursor=pointer]
            - button "2L, i11, double letter, empty" [ref=e402] [cursor=pointer]:
              - generic [ref=e403]: 2L
            - button "j11, empty" [ref=e404] [cursor=pointer]
            - button "k11, empty" [ref=e405] [cursor=pointer]
            - button "l11, empty" [ref=e406] [cursor=pointer]
            - button "3L, m11, triple letter, empty" [ref=e407] [cursor=pointer]:
              - generic [ref=e408]: 3L
            - button "n11, empty" [ref=e409] [cursor=pointer]
            - button "3W, o11, triple word, empty" [ref=e410] [cursor=pointer]:
              - generic [ref=e411]: 3W
            - generic [ref=e412]: "12"
            - button "a12, empty" [ref=e413] [cursor=pointer]
            - button "2L, b12, double letter, empty" [ref=e414] [cursor=pointer]:
              - generic [ref=e415]: 2L
            - button "c12, empty" [ref=e416] [cursor=pointer]
            - button "2W, d12, double word, empty" [ref=e417] [cursor=pointer]:
              - generic [ref=e418]: 2W
            - button "e12, empty" [ref=e419] [cursor=pointer]
            - button "f12, empty" [ref=e420] [cursor=pointer]
            - button "g12, empty" [ref=e421] [cursor=pointer]
            - button "h12, empty" [ref=e422] [cursor=pointer]
            - button "i12, empty" [ref=e423] [cursor=pointer]
            - button "j12, empty" [ref=e424] [cursor=pointer]
            - button "k12, empty" [ref=e425] [cursor=pointer]
            - button "2W, l12, double word, empty" [ref=e426] [cursor=pointer]:
              - generic [ref=e427]: 2W
            - button "m12, empty" [ref=e428] [cursor=pointer]
            - button "2L, n12, double letter, empty" [ref=e429] [cursor=pointer]:
              - generic [ref=e430]: 2L
            - button "o12, empty" [ref=e431] [cursor=pointer]
            - generic [ref=e432]: "13"
            - button "a13, empty" [ref=e433] [cursor=pointer]
            - button "b13, empty" [ref=e434] [cursor=pointer]
            - button "c13, empty" [ref=e435] [cursor=pointer]
            - button "d13, empty" [ref=e436] [cursor=pointer]
            - button "3L, e13, triple letter, empty" [ref=e437] [cursor=pointer]:
              - generic [ref=e438]: 3L
            - button "f13, empty" [ref=e439] [cursor=pointer]
            - button "g13, empty" [ref=e440] [cursor=pointer]
            - button "h13, empty" [ref=e441] [cursor=pointer]
            - button "i13, empty" [ref=e442] [cursor=pointer]
            - button "j13, empty" [ref=e443] [cursor=pointer]
            - button "3L, k13, triple letter, empty" [ref=e444] [cursor=pointer]:
              - generic [ref=e445]: 3L
            - button "l13, empty" [ref=e446] [cursor=pointer]
            - button "m13, empty" [ref=e447] [cursor=pointer]
            - button "n13, empty" [ref=e448] [cursor=pointer]
            - button "o13, empty" [ref=e449] [cursor=pointer]
            - generic [ref=e450]: "14"
            - button "a14, empty" [ref=e451] [cursor=pointer]
            - button "b14, empty" [ref=e452] [cursor=pointer]
            - button "c14, empty" [ref=e453] [cursor=pointer]
            - button "2L, d14, double letter, empty" [ref=e454] [cursor=pointer]:
              - generic [ref=e455]: 2L
            - button "e14, empty" [ref=e456] [cursor=pointer]
            - button "f14, empty" [ref=e457] [cursor=pointer]
            - button "2W, g14, double word, empty" [ref=e458] [cursor=pointer]:
              - generic [ref=e459]: 2W
            - button "h14, empty" [ref=e460] [cursor=pointer]
            - button "2W, i14, double word, empty" [ref=e461] [cursor=pointer]:
              - generic [ref=e462]: 2W
            - button "j14, empty" [ref=e463] [cursor=pointer]
            - button "k14, empty" [ref=e464] [cursor=pointer]
            - button "2L, l14, double letter, empty" [ref=e465] [cursor=pointer]:
              - generic [ref=e466]: 2L
            - button "m14, empty" [ref=e467] [cursor=pointer]
            - button "n14, empty" [ref=e468] [cursor=pointer]
            - button "o14, empty" [ref=e469] [cursor=pointer]
            - generic [ref=e470]: "15"
            - button "2L, a15, double letter, empty" [ref=e471] [cursor=pointer]:
              - generic [ref=e472]: 2L
            - button "b15, empty" [ref=e473] [cursor=pointer]
            - button "c15, empty" [ref=e474] [cursor=pointer]
            - button "d15, empty" [ref=e475] [cursor=pointer]
            - button "3W, e15, triple word, empty" [ref=e476] [cursor=pointer]:
              - generic [ref=e477]: 3W
            - button "f15, empty" [ref=e478] [cursor=pointer]
            - button "g15, empty" [ref=e479] [cursor=pointer]
            - button "2L, h15, double letter, empty" [ref=e480] [cursor=pointer]:
              - generic [ref=e481]: 2L
            - button "i15, empty" [ref=e482] [cursor=pointer]
            - button "j15, empty" [ref=e483] [cursor=pointer]
            - button "3W, k15, triple word, empty" [ref=e484] [cursor=pointer]:
              - generic [ref=e485]: 3W
            - button "l15, empty" [ref=e486] [cursor=pointer]
            - button "m15, empty" [ref=e487] [cursor=pointer]
            - button "n15, empty" [ref=e488] [cursor=pointer]
            - button "2L, o15, double letter, empty" [ref=e489] [cursor=pointer]:
              - generic [ref=e490]: 2L
        - 'button "Board map: locate a square" [ref=e491] [cursor=pointer]':
          - img "Whole board overview; outline shows the enlarged area" [ref=e492]
          - generic [ref=e719]: Map
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
> 35 |     .toBe('success');
     |      ^ Error: expect(received).toBe(expected) // Object.is equality
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
  51 |   await expect(page.locator('#storybook-root')).toHaveScreenshot(
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```