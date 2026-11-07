# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: word-tiles-round-five.checks.ts >> screens-games-word-tiles-puzzle--enlarged-blank regression word-tiles-puzzle-desktop-board-overflow
- Location: tests/storybook/word-tiles-round-five.checks.ts:63:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "success"
Received: "error: expected 882 to be less than or equal to 844"

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e13]:
    - paragraph [ref=e14]: Score at least 20 points in one move.
    - generic [ref=e15]:
      - paragraph [ref=e16]: Choose the letter your blank plays
      - group "Choose the letter your blank plays" [ref=e17]:
        - button "A" [active] [ref=e18] [cursor=pointer]:
          - paragraph [ref=e21]: A
        - button "B" [ref=e22] [cursor=pointer]:
          - paragraph [ref=e25]: B
        - button "C" [ref=e26] [cursor=pointer]:
          - paragraph [ref=e29]: C
        - button "D" [ref=e30] [cursor=pointer]:
          - paragraph [ref=e33]: D
        - button "E" [ref=e34] [cursor=pointer]:
          - paragraph [ref=e37]: E
        - button "F" [ref=e38] [cursor=pointer]:
          - paragraph [ref=e41]: F
        - button "G" [ref=e42] [cursor=pointer]:
          - paragraph [ref=e45]: G
        - button "H" [ref=e46] [cursor=pointer]:
          - paragraph [ref=e49]: H
        - button "I" [ref=e50] [cursor=pointer]:
          - paragraph [ref=e53]: I
        - button "J" [ref=e54] [cursor=pointer]:
          - paragraph [ref=e57]: J
        - button "K" [ref=e58] [cursor=pointer]:
          - paragraph [ref=e61]: K
        - button "L" [ref=e62] [cursor=pointer]:
          - paragraph [ref=e65]: L
        - button "M" [ref=e66] [cursor=pointer]:
          - paragraph [ref=e69]: M
        - button "N" [ref=e70] [cursor=pointer]:
          - paragraph [ref=e73]: "N"
        - button "O" [ref=e74] [cursor=pointer]:
          - paragraph [ref=e77]: O
        - button "P" [ref=e78] [cursor=pointer]:
          - paragraph [ref=e81]: P
        - button "Q" [ref=e82] [cursor=pointer]:
          - paragraph [ref=e85]: Q
        - button "R" [ref=e86] [cursor=pointer]:
          - paragraph [ref=e89]: R
        - button "S" [ref=e90] [cursor=pointer]:
          - paragraph [ref=e93]: S
        - button "T" [ref=e94] [cursor=pointer]:
          - paragraph [ref=e97]: T
        - button "U" [ref=e98] [cursor=pointer]:
          - paragraph [ref=e101]: U
        - button "V" [ref=e102] [cursor=pointer]:
          - paragraph [ref=e105]: V
        - button "W" [ref=e106] [cursor=pointer]:
          - paragraph [ref=e109]: W
        - button "X" [ref=e110] [cursor=pointer]:
          - paragraph [ref=e113]: X
        - button "Y" [ref=e114] [cursor=pointer]:
          - paragraph [ref=e117]: "Y"
        - button "Z" [ref=e118] [cursor=pointer]:
          - paragraph [ref=e121]: Z
    - status [ref=e123]: Choose the letter your blank plays.
    - generic [ref=e124]:
      - button "Play word" [disabled] [ref=e125]:
        - paragraph [ref=e128]: Play word
      - button "Recall tiles" [ref=e129] [cursor=pointer]:
        - paragraph [ref=e132]: Recall tiles
    - group "Your rack" [ref=e133]:
      - button "A, 1 points" [ref=e134] [cursor=pointer]:
        - generic [ref=e135]: A
        - generic [ref=e136]: "1"
      - button "E, 1 points" [ref=e137] [cursor=pointer]:
        - generic [ref=e138]: E
        - generic [ref=e139]: "1"
      - button "S, 1 points" [ref=e140] [cursor=pointer]:
        - generic [ref=e141]: S
        - generic [ref=e142]: "1"
      - button "T, 1 points" [ref=e143] [cursor=pointer]:
        - generic [ref=e144]: T
        - generic [ref=e145]: "1"
      - button "Blank, 0 points, on the board" [disabled] [ref=e146]
      - button "R, 1 points" [ref=e147] [cursor=pointer]:
        - generic [ref=e148]: R
        - generic [ref=e149]: "1"
      - button "N, 1 points" [ref=e150] [cursor=pointer]:
        - generic [ref=e151]: "N"
        - generic [ref=e152]: "1"
    - paragraph [ref=e153]: "j8: 3L triples this letter. Blank tiles score 0."
    - generic [ref=e154]:
      - generic [ref=e155]:
        - button "Fit board" [ref=e156] [cursor=pointer]:
          - paragraph [ref=e159]: Fit board
        - button "Enlarge board" [pressed] [ref=e160] [cursor=pointer]:
          - paragraph [ref=e163]: Enlarge board
      - paragraph [ref=e164]: Scroll or use arrow keys. Map locates squares; Enter places a tile.
      - generic [ref=e165]:
        - region "Scrollable word board" [ref=e166]:
          - group "Puzzle board, fifteen columns and fifteen rows" [ref=e167]:
            - generic [ref=e169]: a
            - generic [ref=e170]: b
            - generic [ref=e171]: c
            - generic [ref=e172]: d
            - generic [ref=e173]: e
            - generic [ref=e174]: f
            - generic [ref=e175]: g
            - generic [ref=e176]: h
            - generic [ref=e177]: i
            - generic [ref=e178]: j
            - generic [ref=e179]: k
            - generic [ref=e180]: l
            - generic [ref=e181]: m
            - generic [ref=e182]: "n"
            - generic [ref=e183]: o
            - generic [ref=e184]: "1"
            - button "2L, a1, double letter, empty" [ref=e185] [cursor=pointer]:
              - generic [ref=e186]: 2L
            - button "b1, empty" [ref=e187] [cursor=pointer]
            - button "c1, empty" [ref=e188] [cursor=pointer]
            - button "d1, empty" [ref=e189] [cursor=pointer]
            - button "3W, e1, triple word, empty" [ref=e190] [cursor=pointer]:
              - generic [ref=e191]: 3W
            - button "f1, empty" [ref=e192] [cursor=pointer]
            - button "g1, empty" [ref=e193] [cursor=pointer]
            - button "2L, h1, double letter, empty" [ref=e194] [cursor=pointer]:
              - generic [ref=e195]: 2L
            - button "i1, empty" [ref=e196] [cursor=pointer]
            - button "j1, empty" [ref=e197] [cursor=pointer]
            - button "3W, k1, triple word, empty" [ref=e198] [cursor=pointer]:
              - generic [ref=e199]: 3W
            - button "l1, empty" [ref=e200] [cursor=pointer]
            - button "m1, empty" [ref=e201] [cursor=pointer]
            - button "n1, empty" [ref=e202] [cursor=pointer]
            - button "2L, o1, double letter, empty" [ref=e203] [cursor=pointer]:
              - generic [ref=e204]: 2L
            - generic [ref=e205]: "2"
            - button "a2, empty" [ref=e206] [cursor=pointer]
            - button "b2, empty" [ref=e207] [cursor=pointer]
            - button "c2, empty" [ref=e208] [cursor=pointer]
            - button "2L, d2, double letter, empty" [ref=e209] [cursor=pointer]:
              - generic [ref=e210]: 2L
            - button "e2, empty" [ref=e211] [cursor=pointer]
            - button "f2, empty" [ref=e212] [cursor=pointer]
            - button "2W, g2, double word, empty" [ref=e213] [cursor=pointer]:
              - generic [ref=e214]: 2W
            - button "h2, empty" [ref=e215] [cursor=pointer]
            - button "2W, i2, double word, empty" [ref=e216] [cursor=pointer]:
              - generic [ref=e217]: 2W
            - button "j2, empty" [ref=e218] [cursor=pointer]
            - button "k2, empty" [ref=e219] [cursor=pointer]
            - button "2L, l2, double letter, empty" [ref=e220] [cursor=pointer]:
              - generic [ref=e221]: 2L
            - button "m2, empty" [ref=e222] [cursor=pointer]
            - button "n2, empty" [ref=e223] [cursor=pointer]
            - button "o2, empty" [ref=e224] [cursor=pointer]
            - generic [ref=e225]: "3"
            - button "a3, empty" [ref=e226] [cursor=pointer]
            - button "b3, empty" [ref=e227] [cursor=pointer]
            - button "c3, empty" [ref=e228] [cursor=pointer]
            - button "d3, empty" [ref=e229] [cursor=pointer]
            - button "3L, e3, triple letter, empty" [ref=e230] [cursor=pointer]:
              - generic [ref=e231]: 3L
            - button "f3, empty" [ref=e232] [cursor=pointer]
            - button "g3, empty" [ref=e233] [cursor=pointer]
            - button "h3, empty" [ref=e234] [cursor=pointer]
            - button "i3, empty" [ref=e235] [cursor=pointer]
            - button "j3, empty" [ref=e236] [cursor=pointer]
            - button "3L, k3, triple letter, empty" [ref=e237] [cursor=pointer]:
              - generic [ref=e238]: 3L
            - button "l3, empty" [ref=e239] [cursor=pointer]
            - button "m3, empty" [ref=e240] [cursor=pointer]
            - button "n3, empty" [ref=e241] [cursor=pointer]
            - button "o3, empty" [ref=e242] [cursor=pointer]
            - generic [ref=e243]: "4"
            - button "a4, empty" [ref=e244] [cursor=pointer]
            - button "2L, b4, double letter, empty" [ref=e245] [cursor=pointer]:
              - generic [ref=e246]: 2L
            - button "c4, empty" [ref=e247] [cursor=pointer]
            - button "2W, d4, double word, empty" [ref=e248] [cursor=pointer]:
              - generic [ref=e249]: 2W
            - button "e4, empty" [ref=e250] [cursor=pointer]
            - button "f4, empty" [ref=e251] [cursor=pointer]
            - button "g4, empty" [ref=e252] [cursor=pointer]
            - button "h4, empty" [ref=e253] [cursor=pointer]
            - button "i4, empty" [ref=e254] [cursor=pointer]
            - button "j4, empty" [ref=e255] [cursor=pointer]
            - button "k4, empty" [ref=e256] [cursor=pointer]
            - button "2W, l4, double word, empty" [ref=e257] [cursor=pointer]:
              - generic [ref=e258]: 2W
            - button "m4, empty" [ref=e259] [cursor=pointer]
            - button "2L, n4, double letter, empty" [ref=e260] [cursor=pointer]:
              - generic [ref=e261]: 2L
            - button "o4, empty" [ref=e262] [cursor=pointer]
            - generic [ref=e263]: "5"
            - button "3W, a5, triple word, empty" [ref=e264] [cursor=pointer]:
              - generic [ref=e265]: 3W
            - button "b5, empty" [ref=e266] [cursor=pointer]
            - button "3L, c5, triple letter, empty" [ref=e267] [cursor=pointer]:
              - generic [ref=e268]: 3L
            - button "d5, empty" [ref=e269] [cursor=pointer]
            - button "e5, empty" [ref=e270] [cursor=pointer]
            - button "f5, empty" [ref=e271] [cursor=pointer]
            - button "2L, g5, double letter, empty" [ref=e272] [cursor=pointer]:
              - generic [ref=e273]: 2L
            - button "h5, empty" [ref=e274] [cursor=pointer]
            - button "2L, i5, double letter, empty" [ref=e275] [cursor=pointer]:
              - generic [ref=e276]: 2L
            - button "j5, empty" [ref=e277] [cursor=pointer]
            - button "k5, empty" [ref=e278] [cursor=pointer]
            - button "l5, empty" [ref=e279] [cursor=pointer]
            - button "3L, m5, triple letter, empty" [ref=e280] [cursor=pointer]:
              - generic [ref=e281]: 3L
            - button "n5, empty" [ref=e282] [cursor=pointer]
            - button "3W, o5, triple word, empty" [ref=e283] [cursor=pointer]:
              - generic [ref=e284]: 3W
            - generic [ref=e285]: "6"
            - button "a6, empty" [ref=e286] [cursor=pointer]
            - button "b6, empty" [ref=e287] [cursor=pointer]
            - button "c6, empty" [ref=e288] [cursor=pointer]
            - button "d6, empty" [ref=e289] [cursor=pointer]
            - button "e6, empty" [ref=e290] [cursor=pointer]
            - button "f6, empty" [ref=e291] [cursor=pointer]
            - button "g6, empty" [ref=e292] [cursor=pointer]
            - button "3L, h6, triple letter, empty" [ref=e293] [cursor=pointer]:
              - generic [ref=e294]: 3L
            - button "i6, empty" [ref=e295] [cursor=pointer]
            - button "j6, empty" [ref=e296] [cursor=pointer]
            - button "k6, empty" [ref=e297] [cursor=pointer]
            - button "l6, empty" [ref=e298] [cursor=pointer]
            - button "m6, empty" [ref=e299] [cursor=pointer]
            - button "n6, empty" [ref=e300] [cursor=pointer]
            - button "o6, empty" [ref=e301] [cursor=pointer]
            - generic [ref=e302]: "7"
            - button "a7, empty" [ref=e303] [cursor=pointer]
            - button "2W, b7, double word, empty" [ref=e304] [cursor=pointer]:
              - generic [ref=e305]: 2W
            - button "c7, empty" [ref=e306] [cursor=pointer]
            - button "d7, empty" [ref=e307] [cursor=pointer]
            - button "2L, e7, double letter, empty" [ref=e308] [cursor=pointer]:
              - generic [ref=e309]: 2L
            - button "f7, empty" [ref=e310] [cursor=pointer]
            - button "2L, g7, double letter, empty" [ref=e311] [cursor=pointer]:
              - generic [ref=e312]: 2L
            - button "h7, empty" [ref=e313] [cursor=pointer]
            - button "2L, i7, double letter, empty" [ref=e314] [cursor=pointer]:
              - generic [ref=e315]: 2L
            - button "j7, empty" [ref=e316] [cursor=pointer]
            - button "2L, k7, double letter, empty" [ref=e317] [cursor=pointer]:
              - generic [ref=e318]: 2L
            - button "l7, empty" [ref=e319] [cursor=pointer]
            - button "m7, empty" [ref=e320] [cursor=pointer]
            - button "2W, n7, double word, empty" [ref=e321] [cursor=pointer]:
              - generic [ref=e322]: 2W
            - button "o7, empty" [ref=e323] [cursor=pointer]
            - generic [ref=e324]: "8"
            - button "2L, a8, double letter, empty" [ref=e325] [cursor=pointer]:
              - generic [ref=e326]: 2L
            - button "b8, empty" [ref=e327] [cursor=pointer]
            - button "c8, empty" [ref=e328] [cursor=pointer]
            - button "d8, empty" [ref=e329] [cursor=pointer]
            - button "e8, empty" [ref=e330] [cursor=pointer]
            - button "3L, f8, triple letter, empty" [ref=e331] [cursor=pointer]:
              - generic [ref=e332]: 3L
            - button "C 3, g8, committed" [disabled] [ref=e333]:
              - generic [ref=e334]: C
              - generic [ref=e335]: "3"
            - button "A 1, h8, committed" [disabled] [ref=e336]:
              - generic [ref=e337]: A
              - generic [ref=e338]: "1"
            - button "T 1, i8, committed" [disabled] [ref=e339]:
              - generic [ref=e340]: T
              - generic [ref=e341]: "1"
            - button "A 0, j8, your tentative blank as A" [ref=e342] [cursor=pointer]:
              - generic [ref=e343]: A
              - generic [ref=e344]: "0"
            - button "k8, empty" [ref=e345] [cursor=pointer]
            - button "l8, empty" [ref=e346] [cursor=pointer]
            - button "m8, empty" [ref=e347] [cursor=pointer]
            - button "n8, empty" [ref=e348] [cursor=pointer]
            - button "2L, o8, double letter, empty" [ref=e349] [cursor=pointer]:
              - generic [ref=e350]: 2L
            - generic [ref=e351]: "9"
            - button "a9, empty" [ref=e352] [cursor=pointer]
            - button "2W, b9, double word, empty" [ref=e353] [cursor=pointer]:
              - generic [ref=e354]: 2W
            - button "c9, empty" [ref=e355] [cursor=pointer]
            - button "d9, empty" [ref=e356] [cursor=pointer]
            - button "2L, e9, double letter, empty" [ref=e357] [cursor=pointer]:
              - generic [ref=e358]: 2L
            - button "f9, empty" [ref=e359] [cursor=pointer]
            - button "2L, g9, double letter, empty" [ref=e360] [cursor=pointer]:
              - generic [ref=e361]: 2L
            - button "h9, empty" [ref=e362] [cursor=pointer]
            - button "O 1, i9, committed" [disabled] [ref=e363]:
              - generic [ref=e364]: O
              - generic [ref=e365]: "1"
            - button "j9, empty" [ref=e366] [cursor=pointer]
            - button "2L, k9, double letter, empty" [ref=e367] [cursor=pointer]:
              - generic [ref=e368]: 2L
            - button "l9, empty" [ref=e369] [cursor=pointer]
            - button "m9, empty" [ref=e370] [cursor=pointer]
            - button "2W, n9, double word, empty" [ref=e371] [cursor=pointer]:
              - generic [ref=e372]: 2W
            - button "o9, empty" [ref=e373] [cursor=pointer]
            - generic [ref=e374]: "10"
            - button "a10, empty" [ref=e375] [cursor=pointer]
            - button "b10, empty" [ref=e376] [cursor=pointer]
            - button "c10, empty" [ref=e377] [cursor=pointer]
            - button "d10, empty" [ref=e378] [cursor=pointer]
            - button "e10, empty" [ref=e379] [cursor=pointer]
            - button "f10, empty" [ref=e380] [cursor=pointer]
            - button "g10, empty" [ref=e381] [cursor=pointer]
            - button "3L, h10, triple letter, empty" [ref=e382] [cursor=pointer]:
              - generic [ref=e383]: 3L
            - button "E 1, i10, committed" [disabled] [ref=e384]:
              - generic [ref=e385]: E
              - generic [ref=e386]: "1"
            - button "j10, empty" [ref=e387] [cursor=pointer]
            - button "k10, empty" [ref=e388] [cursor=pointer]
            - button "l10, empty" [ref=e389] [cursor=pointer]
            - button "m10, empty" [ref=e390] [cursor=pointer]
            - button "n10, empty" [ref=e391] [cursor=pointer]
            - button "o10, empty" [ref=e392] [cursor=pointer]
            - generic [ref=e393]: "11"
            - button "3W, a11, triple word, empty" [ref=e394] [cursor=pointer]:
              - generic [ref=e395]: 3W
            - button "b11, empty" [ref=e396] [cursor=pointer]
            - button "3L, c11, triple letter, empty" [ref=e397] [cursor=pointer]:
              - generic [ref=e398]: 3L
            - button "d11, empty" [ref=e399] [cursor=pointer]
            - button "e11, empty" [ref=e400] [cursor=pointer]
            - button "f11, empty" [ref=e401] [cursor=pointer]
            - button "2L, g11, double letter, empty" [ref=e402] [cursor=pointer]:
              - generic [ref=e403]: 2L
            - button "h11, empty" [ref=e404] [cursor=pointer]
            - button "2L, i11, double letter, empty" [ref=e405] [cursor=pointer]:
              - generic [ref=e406]: 2L
            - button "j11, empty" [ref=e407] [cursor=pointer]
            - button "k11, empty" [ref=e408] [cursor=pointer]
            - button "l11, empty" [ref=e409] [cursor=pointer]
            - button "3L, m11, triple letter, empty" [ref=e410] [cursor=pointer]:
              - generic [ref=e411]: 3L
            - button "n11, empty" [ref=e412] [cursor=pointer]
            - button "3W, o11, triple word, empty" [ref=e413] [cursor=pointer]:
              - generic [ref=e414]: 3W
            - generic [ref=e415]: "12"
            - button "a12, empty" [ref=e416] [cursor=pointer]
            - button "2L, b12, double letter, empty" [ref=e417] [cursor=pointer]:
              - generic [ref=e418]: 2L
            - button "c12, empty" [ref=e419] [cursor=pointer]
            - button "2W, d12, double word, empty" [ref=e420] [cursor=pointer]:
              - generic [ref=e421]: 2W
            - button "e12, empty" [ref=e422] [cursor=pointer]
            - button "f12, empty" [ref=e423] [cursor=pointer]
            - button "g12, empty" [ref=e424] [cursor=pointer]
            - button "h12, empty" [ref=e425] [cursor=pointer]
            - button "i12, empty" [ref=e426] [cursor=pointer]
            - button "j12, empty" [ref=e427] [cursor=pointer]
            - button "k12, empty" [ref=e428] [cursor=pointer]
            - button "2W, l12, double word, empty" [ref=e429] [cursor=pointer]:
              - generic [ref=e430]: 2W
            - button "m12, empty" [ref=e431] [cursor=pointer]
            - button "2L, n12, double letter, empty" [ref=e432] [cursor=pointer]:
              - generic [ref=e433]: 2L
            - button "o12, empty" [ref=e434] [cursor=pointer]
            - generic [ref=e435]: "13"
            - button "a13, empty" [ref=e436] [cursor=pointer]
            - button "b13, empty" [ref=e437] [cursor=pointer]
            - button "c13, empty" [ref=e438] [cursor=pointer]
            - button "d13, empty" [ref=e439] [cursor=pointer]
            - button "3L, e13, triple letter, empty" [ref=e440] [cursor=pointer]:
              - generic [ref=e441]: 3L
            - button "f13, empty" [ref=e442] [cursor=pointer]
            - button "g13, empty" [ref=e443] [cursor=pointer]
            - button "h13, empty" [ref=e444] [cursor=pointer]
            - button "i13, empty" [ref=e445] [cursor=pointer]
            - button "j13, empty" [ref=e446] [cursor=pointer]
            - button "3L, k13, triple letter, empty" [ref=e447] [cursor=pointer]:
              - generic [ref=e448]: 3L
            - button "l13, empty" [ref=e449] [cursor=pointer]
            - button "m13, empty" [ref=e450] [cursor=pointer]
            - button "n13, empty" [ref=e451] [cursor=pointer]
            - button "o13, empty" [ref=e452] [cursor=pointer]
            - generic [ref=e453]: "14"
            - button "a14, empty" [ref=e454] [cursor=pointer]
            - button "b14, empty" [ref=e455] [cursor=pointer]
            - button "c14, empty" [ref=e456] [cursor=pointer]
            - button "2L, d14, double letter, empty" [ref=e457] [cursor=pointer]:
              - generic [ref=e458]: 2L
            - button "e14, empty" [ref=e459] [cursor=pointer]
            - button "f14, empty" [ref=e460] [cursor=pointer]
            - button "2W, g14, double word, empty" [ref=e461] [cursor=pointer]:
              - generic [ref=e462]: 2W
            - button "h14, empty" [ref=e463] [cursor=pointer]
            - button "2W, i14, double word, empty" [ref=e464] [cursor=pointer]:
              - generic [ref=e465]: 2W
            - button "j14, empty" [ref=e466] [cursor=pointer]
            - button "k14, empty" [ref=e467] [cursor=pointer]
            - button "2L, l14, double letter, empty" [ref=e468] [cursor=pointer]:
              - generic [ref=e469]: 2L
            - button "m14, empty" [ref=e470] [cursor=pointer]
            - button "n14, empty" [ref=e471] [cursor=pointer]
            - button "o14, empty" [ref=e472] [cursor=pointer]
            - generic [ref=e473]: "15"
            - button "2L, a15, double letter, empty" [ref=e474] [cursor=pointer]:
              - generic [ref=e475]: 2L
            - button "b15, empty" [ref=e476] [cursor=pointer]
            - button "c15, empty" [ref=e477] [cursor=pointer]
            - button "d15, empty" [ref=e478] [cursor=pointer]
            - button "3W, e15, triple word, empty" [ref=e479] [cursor=pointer]:
              - generic [ref=e480]: 3W
            - button "f15, empty" [ref=e481] [cursor=pointer]
            - button "g15, empty" [ref=e482] [cursor=pointer]
            - button "2L, h15, double letter, empty" [ref=e483] [cursor=pointer]:
              - generic [ref=e484]: 2L
            - button "i15, empty" [ref=e485] [cursor=pointer]
            - button "j15, empty" [ref=e486] [cursor=pointer]
            - button "3W, k15, triple word, empty" [ref=e487] [cursor=pointer]:
              - generic [ref=e488]: 3W
            - button "l15, empty" [ref=e489] [cursor=pointer]
            - button "m15, empty" [ref=e490] [cursor=pointer]
            - button "n15, empty" [ref=e491] [cursor=pointer]
            - button "2L, o15, double letter, empty" [ref=e492] [cursor=pointer]:
              - generic [ref=e493]: 2L
        - 'button "Board map: locate a square" [ref=e494] [cursor=pointer]':
          - img "Whole board overview; outline shows the enlarged area" [ref=e495]
          - generic [ref=e722]: Map
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