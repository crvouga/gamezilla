# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: board-round-four.checks.ts >> screens-games-word-tiles-board--enlarged-coordinates regression word-tiles-enlarged-context-loss
- Location: tests/storybook/board-round-four.checks.ts:72:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "success"
Received: "error: expected false to be true // Object.is equality"

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e12]:
    - generic [ref=e13]:
      - heading "Word Tiles" [level=1] [ref=e16]
      - generic [ref=e18]:
        - generic [ref=e19]: Unrated
        - generic [ref=e20]: ·Untimed
    - generic [ref=e21]:
      - generic [ref=e23]:
        - paragraph [ref=e24]: Amber — to play · 86 tiles in the bag
        - generic [ref=e25]:
          - paragraph [ref=e30]: No moves yet.
          - button "All moves" [ref=e31] [cursor=pointer]:
            - img [ref=e35]
      - generic [ref=e37]:
        - generic [ref=e39]:
          - generic [ref=e41]:
            - generic [ref=e45]:
              - generic [ref=e46]:
                - img "Teal" [ref=e47]
                - generic "jordan_plays" [ref=e50]
              - generic [ref=e53]: 7 tiles
            - generic [ref=e54]:
              - generic [ref=e55]: Score
              - generic [ref=e56]: "0"
          - generic [ref=e58]:
            - group "Your rack" [ref=e59]:
              - button "C, 3 points" [ref=e60] [cursor=pointer]:
                - generic [ref=e61]: C
                - generic [ref=e62]: "3"
              - button "A, 1 points" [ref=e63] [cursor=pointer]:
                - generic [ref=e64]: A
                - generic [ref=e65]: "1"
              - button "T, 1 points" [ref=e66] [cursor=pointer]:
                - generic [ref=e67]: T
                - generic [ref=e68]: "1"
              - button "Blank, 0 points" [ref=e69] [cursor=pointer]:
                - generic [ref=e70]: "0"
              - button "E, 1 points" [ref=e71] [cursor=pointer]:
                - generic [ref=e72]: E
                - generic [ref=e73]: "1"
              - button "S, 1 points" [ref=e74] [cursor=pointer]:
                - generic [ref=e75]: S
                - generic [ref=e76]: "1"
              - button "Q, 10 points" [ref=e77] [cursor=pointer]:
                - generic [ref=e78]: Q
                - generic [ref=e79]: "10"
            - generic [ref=e80]:
              - group "Word actions" [ref=e82]:
                - button "Play word" [disabled] [ref=e83]:
                  - paragraph [ref=e86]: Play word
                - button "More actions" [ref=e87] [cursor=pointer]:
                  - paragraph [ref=e90]: More actions
              - status [ref=e93]: Choose a tile, then a square.
            - generic [ref=e94]:
              - generic [ref=e95]:
                - button "Fit board" [pressed] [ref=e96] [cursor=pointer]:
                  - paragraph [ref=e99]: Fit board
                - button "Enlarge board" [ref=e100] [cursor=pointer]:
                  - paragraph [ref=e103]: Enlarge board
              - region "Scrollable word board" [ref=e105]:
                - group "Word board, fifteen columns and fifteen rows" [ref=e106]:
                  - generic [ref=e108]: a
                  - generic [ref=e109]: b
                  - generic [ref=e110]: c
                  - generic [ref=e111]: d
                  - generic [ref=e112]: e
                  - generic [ref=e113]: f
                  - generic [ref=e114]: g
                  - generic [ref=e115]: h
                  - generic [ref=e116]: i
                  - generic [ref=e117]: j
                  - generic [ref=e118]: k
                  - generic [ref=e119]: l
                  - generic [ref=e120]: m
                  - generic [ref=e121]: "n"
                  - generic [ref=e122]: o
                  - generic [ref=e123]: "1"
                  - button "2L, a1, double letter, empty" [ref=e124] [cursor=pointer]:
                    - generic [ref=e125]: 2L
                  - button "b1, empty" [ref=e126] [cursor=pointer]
                  - button "c1, empty" [ref=e127] [cursor=pointer]
                  - button "d1, empty" [ref=e128] [cursor=pointer]
                  - button "3W, e1, triple word, empty" [ref=e129] [cursor=pointer]:
                    - generic [ref=e130]: 3W
                  - button "f1, empty" [ref=e131] [cursor=pointer]
                  - button "g1, empty" [ref=e132] [cursor=pointer]
                  - button "2L, h1, double letter, empty" [ref=e133] [cursor=pointer]:
                    - generic [ref=e134]: 2L
                  - button "i1, empty" [ref=e135] [cursor=pointer]
                  - button "j1, empty" [ref=e136] [cursor=pointer]
                  - button "3W, k1, triple word, empty" [ref=e137] [cursor=pointer]:
                    - generic [ref=e138]: 3W
                  - button "l1, empty" [ref=e139] [cursor=pointer]
                  - button "m1, empty" [ref=e140] [cursor=pointer]
                  - button "n1, empty" [ref=e141] [cursor=pointer]
                  - button "2L, o1, double letter, empty" [ref=e142] [cursor=pointer]:
                    - generic [ref=e143]: 2L
                  - generic [ref=e144]: "2"
                  - button "a2, empty" [ref=e145] [cursor=pointer]
                  - button "b2, empty" [ref=e146] [cursor=pointer]
                  - button "c2, empty" [ref=e147] [cursor=pointer]
                  - button "2L, d2, double letter, empty" [ref=e148] [cursor=pointer]:
                    - generic [ref=e149]: 2L
                  - button "e2, empty" [ref=e150] [cursor=pointer]
                  - button "f2, empty" [ref=e151] [cursor=pointer]
                  - button "2W, g2, double word, empty" [ref=e152] [cursor=pointer]:
                    - generic [ref=e153]: 2W
                  - button "h2, empty" [ref=e154] [cursor=pointer]
                  - button "2W, i2, double word, empty" [ref=e155] [cursor=pointer]:
                    - generic [ref=e156]: 2W
                  - button "j2, empty" [ref=e157] [cursor=pointer]
                  - button "k2, empty" [ref=e158] [cursor=pointer]
                  - button "2L, l2, double letter, empty" [ref=e159] [cursor=pointer]:
                    - generic [ref=e160]: 2L
                  - button "m2, empty" [ref=e161] [cursor=pointer]
                  - button "n2, empty" [ref=e162] [cursor=pointer]
                  - button "o2, empty" [ref=e163] [cursor=pointer]
                  - generic [ref=e164]: "3"
                  - button "a3, empty" [ref=e165] [cursor=pointer]
                  - button "b3, empty" [ref=e166] [cursor=pointer]
                  - button "c3, empty" [ref=e167] [cursor=pointer]
                  - button "d3, empty" [ref=e168] [cursor=pointer]
                  - button "3L, e3, triple letter, empty" [ref=e169] [cursor=pointer]:
                    - generic [ref=e170]: 3L
                  - button "f3, empty" [ref=e171] [cursor=pointer]
                  - button "g3, empty" [ref=e172] [cursor=pointer]
                  - button "h3, empty" [ref=e173] [cursor=pointer]
                  - button "i3, empty" [ref=e174] [cursor=pointer]
                  - button "j3, empty" [ref=e175] [cursor=pointer]
                  - button "3L, k3, triple letter, empty" [ref=e176] [cursor=pointer]:
                    - generic [ref=e177]: 3L
                  - button "l3, empty" [ref=e178] [cursor=pointer]
                  - button "m3, empty" [ref=e179] [cursor=pointer]
                  - button "n3, empty" [ref=e180] [cursor=pointer]
                  - button "o3, empty" [ref=e181] [cursor=pointer]
                  - generic [ref=e182]: "4"
                  - button "a4, empty" [ref=e183] [cursor=pointer]
                  - button "2L, b4, double letter, empty" [ref=e184] [cursor=pointer]:
                    - generic [ref=e185]: 2L
                  - button "c4, empty" [ref=e186] [cursor=pointer]
                  - button "2W, d4, double word, empty" [ref=e187] [cursor=pointer]:
                    - generic [ref=e188]: 2W
                  - button "e4, empty" [ref=e189] [cursor=pointer]
                  - button "f4, empty" [ref=e190] [cursor=pointer]
                  - button "g4, empty" [ref=e191] [cursor=pointer]
                  - button "h4, empty" [ref=e192] [cursor=pointer]
                  - button "i4, empty" [ref=e193] [cursor=pointer]
                  - button "j4, empty" [ref=e194] [cursor=pointer]
                  - button "k4, empty" [ref=e195] [cursor=pointer]
                  - button "2W, l4, double word, empty" [ref=e196] [cursor=pointer]:
                    - generic [ref=e197]: 2W
                  - button "m4, empty" [ref=e198] [cursor=pointer]
                  - button "2L, n4, double letter, empty" [ref=e199] [cursor=pointer]:
                    - generic [ref=e200]: 2L
                  - button "o4, empty" [ref=e201] [cursor=pointer]
                  - generic [ref=e202]: "5"
                  - button "3W, a5, triple word, empty" [ref=e203] [cursor=pointer]:
                    - generic [ref=e204]: 3W
                  - button "b5, empty" [ref=e205] [cursor=pointer]
                  - button "3L, c5, triple letter, empty" [ref=e206] [cursor=pointer]:
                    - generic [ref=e207]: 3L
                  - button "d5, empty" [ref=e208] [cursor=pointer]
                  - button "e5, empty" [ref=e209] [cursor=pointer]
                  - button "f5, empty" [ref=e210] [cursor=pointer]
                  - button "2L, g5, double letter, empty" [ref=e211] [cursor=pointer]:
                    - generic [ref=e212]: 2L
                  - button "h5, empty" [ref=e213] [cursor=pointer]
                  - button "2L, i5, double letter, empty" [ref=e214] [cursor=pointer]:
                    - generic [ref=e215]: 2L
                  - button "j5, empty" [ref=e216] [cursor=pointer]
                  - button "k5, empty" [ref=e217] [cursor=pointer]
                  - button "l5, empty" [ref=e218] [cursor=pointer]
                  - button "3L, m5, triple letter, empty" [ref=e219] [cursor=pointer]:
                    - generic [ref=e220]: 3L
                  - button "n5, empty" [ref=e221] [cursor=pointer]
                  - button "3W, o5, triple word, empty" [ref=e222] [cursor=pointer]:
                    - generic [ref=e223]: 3W
                  - generic [ref=e224]: "6"
                  - button "a6, empty" [ref=e225] [cursor=pointer]
                  - button "b6, empty" [ref=e226] [cursor=pointer]
                  - button "c6, empty" [ref=e227] [cursor=pointer]
                  - button "d6, empty" [ref=e228] [cursor=pointer]
                  - button "e6, empty" [ref=e229] [cursor=pointer]
                  - button "f6, empty" [ref=e230] [cursor=pointer]
                  - button "g6, empty" [ref=e231] [cursor=pointer]
                  - button "3L, h6, triple letter, empty" [ref=e232] [cursor=pointer]:
                    - generic [ref=e233]: 3L
                  - button "i6, empty" [ref=e234] [cursor=pointer]
                  - button "j6, empty" [ref=e235] [cursor=pointer]
                  - button "k6, empty" [ref=e236] [cursor=pointer]
                  - button "l6, empty" [ref=e237] [cursor=pointer]
                  - button "m6, empty" [ref=e238] [cursor=pointer]
                  - button "n6, empty" [ref=e239] [cursor=pointer]
                  - button "o6, empty" [ref=e240] [cursor=pointer]
                  - generic [ref=e241]: "7"
                  - button "a7, empty" [ref=e242] [cursor=pointer]
                  - button "2W, b7, double word, empty" [ref=e243] [cursor=pointer]:
                    - generic [ref=e244]: 2W
                  - button "c7, empty" [ref=e245] [cursor=pointer]
                  - button "d7, empty" [ref=e246] [cursor=pointer]
                  - button "2L, e7, double letter, empty" [ref=e247] [cursor=pointer]:
                    - generic [ref=e248]: 2L
                  - button "f7, empty" [ref=e249] [cursor=pointer]
                  - button "2L, g7, double letter, empty" [ref=e250] [cursor=pointer]:
                    - generic [ref=e251]: 2L
                  - button "h7, empty" [ref=e252] [cursor=pointer]
                  - button "2L, i7, double letter, empty" [ref=e253] [cursor=pointer]:
                    - generic [ref=e254]: 2L
                  - button "j7, empty" [ref=e255] [cursor=pointer]
                  - button "2L, k7, double letter, empty" [ref=e256] [cursor=pointer]:
                    - generic [ref=e257]: 2L
                  - button "l7, empty" [ref=e258] [cursor=pointer]
                  - button "m7, empty" [ref=e259] [cursor=pointer]
                  - button "2W, n7, double word, empty" [ref=e260] [cursor=pointer]:
                    - generic [ref=e261]: 2W
                  - button "o7, empty" [ref=e262] [cursor=pointer]
                  - generic [ref=e263]: "8"
                  - button "2L, a8, double letter, empty" [ref=e264] [cursor=pointer]:
                    - generic [ref=e265]: 2L
                  - button "b8, empty" [ref=e266] [cursor=pointer]
                  - button "c8, empty" [ref=e267] [cursor=pointer]
                  - button "d8, empty" [ref=e268] [cursor=pointer]
                  - button "e8, empty" [ref=e269] [cursor=pointer]
                  - button "3L, f8, triple letter, empty" [ref=e270] [cursor=pointer]:
                    - generic [ref=e271]: 3L
                  - button "g8, empty" [ref=e272] [cursor=pointer]
                  - button "★, h8, start, double word, empty" [ref=e273] [cursor=pointer]:
                    - generic [ref=e274]: ★
                  - button "i8, empty" [ref=e275] [cursor=pointer]
                  - button "3L, j8, triple letter, empty" [ref=e276] [cursor=pointer]:
                    - generic [ref=e277]: 3L
                  - button "k8, empty" [ref=e278] [cursor=pointer]
                  - button "l8, empty" [ref=e279] [cursor=pointer]
                  - button "m8, empty" [ref=e280] [cursor=pointer]
                  - button "n8, empty" [ref=e281] [cursor=pointer]
                  - button "2L, o8, double letter, empty" [ref=e282] [cursor=pointer]:
                    - generic [ref=e283]: 2L
                  - generic [ref=e284]: "9"
                  - button "a9, empty" [ref=e285] [cursor=pointer]
                  - button "2W, b9, double word, empty" [ref=e286] [cursor=pointer]:
                    - generic [ref=e287]: 2W
                  - button "c9, empty" [ref=e288] [cursor=pointer]
                  - button "d9, empty" [ref=e289] [cursor=pointer]
                  - button "2L, e9, double letter, empty" [ref=e290] [cursor=pointer]:
                    - generic [ref=e291]: 2L
                  - button "f9, empty" [ref=e292] [cursor=pointer]
                  - button "2L, g9, double letter, empty" [ref=e293] [cursor=pointer]:
                    - generic [ref=e294]: 2L
                  - button "h9, empty" [ref=e295] [cursor=pointer]
                  - button "2L, i9, double letter, empty" [ref=e296] [cursor=pointer]:
                    - generic [ref=e297]: 2L
                  - button "j9, empty" [ref=e298] [cursor=pointer]
                  - button "2L, k9, double letter, empty" [ref=e299] [cursor=pointer]:
                    - generic [ref=e300]: 2L
                  - button "l9, empty" [ref=e301] [cursor=pointer]
                  - button "m9, empty" [ref=e302] [cursor=pointer]
                  - button "2W, n9, double word, empty" [ref=e303] [cursor=pointer]:
                    - generic [ref=e304]: 2W
                  - button "o9, empty" [ref=e305] [cursor=pointer]
                  - generic [ref=e306]: "10"
                  - button "a10, empty" [ref=e307] [cursor=pointer]
                  - button "b10, empty" [ref=e308] [cursor=pointer]
                  - button "c10, empty" [ref=e309] [cursor=pointer]
                  - button "d10, empty" [ref=e310] [cursor=pointer]
                  - button "e10, empty" [ref=e311] [cursor=pointer]
                  - button "f10, empty" [ref=e312] [cursor=pointer]
                  - button "g10, empty" [ref=e313] [cursor=pointer]
                  - button "3L, h10, triple letter, empty" [ref=e314] [cursor=pointer]:
                    - generic [ref=e315]: 3L
                  - button "i10, empty" [ref=e316] [cursor=pointer]
                  - button "j10, empty" [ref=e317] [cursor=pointer]
                  - button "k10, empty" [ref=e318] [cursor=pointer]
                  - button "l10, empty" [ref=e319] [cursor=pointer]
                  - button "m10, empty" [ref=e320] [cursor=pointer]
                  - button "n10, empty" [ref=e321] [cursor=pointer]
                  - button "o10, empty" [ref=e322] [cursor=pointer]
                  - generic [ref=e323]: "11"
                  - button "3W, a11, triple word, empty" [ref=e324] [cursor=pointer]:
                    - generic [ref=e325]: 3W
                  - button "b11, empty" [ref=e326] [cursor=pointer]
                  - button "3L, c11, triple letter, empty" [ref=e327] [cursor=pointer]:
                    - generic [ref=e328]: 3L
                  - button "d11, empty" [ref=e329] [cursor=pointer]
                  - button "e11, empty" [ref=e330] [cursor=pointer]
                  - button "f11, empty" [ref=e331] [cursor=pointer]
                  - button "2L, g11, double letter, empty" [ref=e332] [cursor=pointer]:
                    - generic [ref=e333]: 2L
                  - button "h11, empty" [ref=e334] [cursor=pointer]
                  - button "2L, i11, double letter, empty" [ref=e335] [cursor=pointer]:
                    - generic [ref=e336]: 2L
                  - button "j11, empty" [ref=e337] [cursor=pointer]
                  - button "k11, empty" [ref=e338] [cursor=pointer]
                  - button "l11, empty" [ref=e339] [cursor=pointer]
                  - button "3L, m11, triple letter, empty" [ref=e340] [cursor=pointer]:
                    - generic [ref=e341]: 3L
                  - button "n11, empty" [ref=e342] [cursor=pointer]
                  - button "3W, o11, triple word, empty" [ref=e343] [cursor=pointer]:
                    - generic [ref=e344]: 3W
                  - generic [ref=e345]: "12"
                  - button "a12, empty" [ref=e346] [cursor=pointer]
                  - button "2L, b12, double letter, empty" [ref=e347] [cursor=pointer]:
                    - generic [ref=e348]: 2L
                  - button "c12, empty" [ref=e349] [cursor=pointer]
                  - button "2W, d12, double word, empty" [ref=e350] [cursor=pointer]:
                    - generic [ref=e351]: 2W
                  - button "e12, empty" [ref=e352] [cursor=pointer]
                  - button "f12, empty" [ref=e353] [cursor=pointer]
                  - button "g12, empty" [ref=e354] [cursor=pointer]
                  - button "h12, empty" [ref=e355] [cursor=pointer]
                  - button "i12, empty" [ref=e356] [cursor=pointer]
                  - button "j12, empty" [ref=e357] [cursor=pointer]
                  - button "k12, empty" [ref=e358] [cursor=pointer]
                  - button "2W, l12, double word, empty" [ref=e359] [cursor=pointer]:
                    - generic [ref=e360]: 2W
                  - button "m12, empty" [ref=e361] [cursor=pointer]
                  - button "2L, n12, double letter, empty" [ref=e362] [cursor=pointer]:
                    - generic [ref=e363]: 2L
                  - button "o12, empty" [ref=e364] [cursor=pointer]
                  - generic [ref=e365]: "13"
                  - button "a13, empty" [ref=e366] [cursor=pointer]
                  - button "b13, empty" [ref=e367] [cursor=pointer]
                  - button "c13, empty" [ref=e368] [cursor=pointer]
                  - button "d13, empty" [ref=e369] [cursor=pointer]
                  - button "3L, e13, triple letter, empty" [ref=e370] [cursor=pointer]:
                    - generic [ref=e371]: 3L
                  - button "f13, empty" [ref=e372] [cursor=pointer]
                  - button "g13, empty" [ref=e373] [cursor=pointer]
                  - button "h13, empty" [ref=e374] [cursor=pointer]
                  - button "i13, empty" [ref=e375] [cursor=pointer]
                  - button "j13, empty" [ref=e376] [cursor=pointer]
                  - button "3L, k13, triple letter, empty" [ref=e377] [cursor=pointer]:
                    - generic [ref=e378]: 3L
                  - button "l13, empty" [ref=e379] [cursor=pointer]
                  - button "m13, empty" [ref=e380] [cursor=pointer]
                  - button "n13, empty" [ref=e381] [cursor=pointer]
                  - button "o13, empty" [ref=e382] [cursor=pointer]
                  - generic [ref=e383]: "14"
                  - button "a14, empty" [ref=e384] [cursor=pointer]
                  - button "b14, empty" [ref=e385] [cursor=pointer]
                  - button "c14, empty" [ref=e386] [cursor=pointer]
                  - button "2L, d14, double letter, empty" [ref=e387] [cursor=pointer]:
                    - generic [ref=e388]: 2L
                  - button "e14, empty" [ref=e389] [cursor=pointer]
                  - button "f14, empty" [ref=e390] [cursor=pointer]
                  - button "2W, g14, double word, empty" [ref=e391] [cursor=pointer]:
                    - generic [ref=e392]: 2W
                  - button "h14, empty" [ref=e393] [cursor=pointer]
                  - button "2W, i14, double word, empty" [ref=e394] [cursor=pointer]:
                    - generic [ref=e395]: 2W
                  - button "j14, empty" [ref=e396] [cursor=pointer]
                  - button "k14, empty" [ref=e397] [cursor=pointer]
                  - button "2L, l14, double letter, empty" [ref=e398] [cursor=pointer]:
                    - generic [ref=e399]: 2L
                  - button "m14, empty" [ref=e400] [cursor=pointer]
                  - button "n14, empty" [ref=e401] [cursor=pointer]
                  - button "o14, empty" [ref=e402] [cursor=pointer]
                  - generic [ref=e403]: "15"
                  - button "2L, a15, double letter, empty" [ref=e404] [cursor=pointer]:
                    - generic [ref=e405]: 2L
                  - button "b15, empty" [ref=e406] [cursor=pointer]
                  - button "c15, empty" [ref=e407] [cursor=pointer]
                  - button "d15, empty" [ref=e408] [cursor=pointer]
                  - button "3W, e15, triple word, empty" [ref=e409] [cursor=pointer]:
                    - generic [ref=e410]: 3W
                  - button "f15, empty" [ref=e411] [cursor=pointer]
                  - button "g15, empty" [ref=e412] [cursor=pointer]
                  - button "2L, h15, double letter, empty" [ref=e413] [cursor=pointer]:
                    - generic [ref=e414]: 2L
                  - button "i15, empty" [ref=e415] [cursor=pointer]
                  - button "j15, empty" [ref=e416] [cursor=pointer]
                  - button "3W, k15, triple word, empty" [ref=e417] [cursor=pointer]:
                    - generic [ref=e418]: 3W
                  - button "l15, empty" [ref=e419] [cursor=pointer]
                  - button "m15, empty" [ref=e420] [cursor=pointer]
                  - button "n15, empty" [ref=e421] [cursor=pointer]
                  - button "2L, o15, double letter, empty" [ref=e422] [cursor=pointer]:
                    - generic [ref=e423]: 2L
          - status [ref=e425]:
            - generic [ref=e426]:
              - generic [ref=e427]: "Amber: avery. Teal: jordan_plays."
              - text: Amber — to play · 86 tiles in the bag
          - generic [ref=e430]:
            - generic [ref=e434]:
              - generic [ref=e435]:
                - img "Amber" [ref=e436]
                - generic "avery" [ref=e439]
                - generic [ref=e440]: Your move
              - generic [ref=e443]: 7 tiles
            - generic [ref=e444]:
              - generic [ref=e445]: Score
              - generic [ref=e446]: "0"
        - generic [ref=e449]:
          - group "Game actions" [ref=e450]:
            - button "Offer draw" [ref=e451] [cursor=pointer]:
              - paragraph [ref=e454]: Offer draw
            - button "Resign game" [ref=e455] [cursor=pointer]:
              - paragraph [ref=e458]:
                - text: Resign
                - generic [ref=e459]: game
          - button "History and stats" [ref=e460] [cursor=pointer]:
            - generic [ref=e462]:
              - paragraph [ref=e463]: History and stats
              - img [ref=e466]
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