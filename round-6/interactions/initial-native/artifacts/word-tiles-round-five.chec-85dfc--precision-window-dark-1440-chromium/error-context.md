# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: word-tiles-round-five.checks.ts >> screens-games-word-tiles-board--enlarged-coordinates regression word-tiles-cramped-precision-window dark-1440
- Location: tests/storybook/word-tiles-round-five.checks.ts:26:5

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
- generic [ref=e4]:
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
            - group "Your rack" [ref=e47]:
              - button "C, 3 points" [ref=e48] [cursor=pointer]:
                - generic [ref=e49]: C
                - generic [ref=e50]: "3"
              - button "A, 1 points" [ref=e51] [cursor=pointer]:
                - generic [ref=e52]: A
                - generic [ref=e53]: "1"
              - button "T, 1 points" [ref=e54] [cursor=pointer]:
                - generic [ref=e55]: T
                - generic [ref=e56]: "1"
              - button "Blank, 0 points" [ref=e57] [cursor=pointer]:
                - generic [ref=e58]: "0"
              - button "E, 1 points" [ref=e59] [cursor=pointer]:
                - generic [ref=e60]: E
                - generic [ref=e61]: "1"
              - button "S, 1 points" [ref=e62] [cursor=pointer]:
                - generic [ref=e63]: S
                - generic [ref=e64]: "1"
              - button "Q, 10 points" [ref=e65] [cursor=pointer]:
                - generic [ref=e66]: Q
                - generic [ref=e67]: "10"
            - generic [ref=e68]:
              - group "Word actions" [ref=e70]:
                - button "Play word" [disabled] [ref=e71]:
                  - paragraph [ref=e74]: Play word
                - button "Pass, exchange & tools" [ref=e75] [cursor=pointer]:
                  - paragraph [ref=e78]: Pass, exchange & tools
              - status [ref=e81]: Choose a tile, then a square.
            - generic [ref=e82]:
              - generic [ref=e83]:
                - button "Fit board" [ref=e84] [cursor=pointer]:
                  - paragraph [ref=e87]: Fit board
                - button "Enlarge board" [pressed] [ref=e88] [cursor=pointer]:
                  - paragraph [ref=e91]: Enlarge board
              - paragraph [ref=e92]: Scroll or use arrow keys. Map locates squares; Enter places a tile.
              - generic [ref=e93]:
                - region "Scrollable word board" [ref=e94]:
                  - group "Word board, fifteen columns and fifteen rows" [ref=e95]:
                    - generic [ref=e97]: a
                    - generic [ref=e98]: b
                    - generic [ref=e99]: c
                    - generic [ref=e100]: d
                    - generic [ref=e101]: e
                    - generic [ref=e102]: f
                    - generic [ref=e103]: g
                    - generic [ref=e104]: h
                    - generic [ref=e105]: i
                    - generic [ref=e106]: j
                    - generic [ref=e107]: k
                    - generic [ref=e108]: l
                    - generic [ref=e109]: m
                    - generic [ref=e110]: "n"
                    - generic [ref=e111]: o
                    - generic [ref=e112]: "1"
                    - button "2L, a1, double letter, empty" [ref=e113] [cursor=pointer]:
                      - generic [ref=e114]: 2L
                    - button "b1, empty" [ref=e115] [cursor=pointer]
                    - button "c1, empty" [ref=e116] [cursor=pointer]
                    - button "d1, empty" [ref=e117] [cursor=pointer]
                    - button "3W, e1, triple word, empty" [ref=e118] [cursor=pointer]:
                      - generic [ref=e119]: 3W
                    - button "f1, empty" [ref=e120] [cursor=pointer]
                    - button "g1, empty" [ref=e121] [cursor=pointer]
                    - button "2L, h1, double letter, empty" [ref=e122] [cursor=pointer]:
                      - generic [ref=e123]: 2L
                    - button "i1, empty" [ref=e124] [cursor=pointer]
                    - button "j1, empty" [ref=e125] [cursor=pointer]
                    - button "3W, k1, triple word, empty" [ref=e126] [cursor=pointer]:
                      - generic [ref=e127]: 3W
                    - button "l1, empty" [ref=e128] [cursor=pointer]
                    - button "m1, empty" [ref=e129] [cursor=pointer]
                    - button "n1, empty" [ref=e130] [cursor=pointer]
                    - button "2L, o1, double letter, empty" [ref=e131] [cursor=pointer]:
                      - generic [ref=e132]: 2L
                    - generic [ref=e133]: "2"
                    - button "a2, empty" [ref=e134] [cursor=pointer]
                    - button "b2, empty" [ref=e135] [cursor=pointer]
                    - button "c2, empty" [ref=e136] [cursor=pointer]
                    - button "2L, d2, double letter, empty" [ref=e137] [cursor=pointer]:
                      - generic [ref=e138]: 2L
                    - button "e2, empty" [ref=e139] [cursor=pointer]
                    - button "f2, empty" [ref=e140] [cursor=pointer]
                    - button "2W, g2, double word, empty" [ref=e141] [cursor=pointer]:
                      - generic [ref=e142]: 2W
                    - button "h2, empty" [ref=e143] [cursor=pointer]
                    - button "2W, i2, double word, empty" [ref=e144] [cursor=pointer]:
                      - generic [ref=e145]: 2W
                    - button "j2, empty" [ref=e146] [cursor=pointer]
                    - button "k2, empty" [ref=e147] [cursor=pointer]
                    - button "2L, l2, double letter, empty" [ref=e148] [cursor=pointer]:
                      - generic [ref=e149]: 2L
                    - button "m2, empty" [ref=e150] [cursor=pointer]
                    - button "n2, empty" [ref=e151] [cursor=pointer]
                    - button "o2, empty" [ref=e152] [cursor=pointer]
                    - generic [ref=e153]: "3"
                    - button "a3, empty" [ref=e154] [cursor=pointer]
                    - button "b3, empty" [ref=e155] [cursor=pointer]
                    - button "c3, empty" [ref=e156] [cursor=pointer]
                    - button "d3, empty" [ref=e157] [cursor=pointer]
                    - button "3L, e3, triple letter, empty" [ref=e158] [cursor=pointer]:
                      - generic [ref=e159]: 3L
                    - button "f3, empty" [ref=e160] [cursor=pointer]
                    - button "g3, empty" [ref=e161] [cursor=pointer]
                    - button "h3, empty" [ref=e162] [cursor=pointer]
                    - button "i3, empty" [ref=e163] [cursor=pointer]
                    - button "j3, empty" [ref=e164] [cursor=pointer]
                    - button "3L, k3, triple letter, empty" [ref=e165] [cursor=pointer]:
                      - generic [ref=e166]: 3L
                    - button "l3, empty" [ref=e167] [cursor=pointer]
                    - button "m3, empty" [ref=e168] [cursor=pointer]
                    - button "n3, empty" [ref=e169] [cursor=pointer]
                    - button "o3, empty" [ref=e170] [cursor=pointer]
                    - generic [ref=e171]: "4"
                    - button "a4, empty" [ref=e172] [cursor=pointer]
                    - button "2L, b4, double letter, empty" [ref=e173] [cursor=pointer]:
                      - generic [ref=e174]: 2L
                    - button "c4, empty" [ref=e175] [cursor=pointer]
                    - button "2W, d4, double word, empty" [ref=e176] [cursor=pointer]:
                      - generic [ref=e177]: 2W
                    - button "e4, empty" [ref=e178] [cursor=pointer]
                    - button "f4, empty" [ref=e179] [cursor=pointer]
                    - button "g4, empty" [ref=e180] [cursor=pointer]
                    - button "h4, empty" [ref=e181] [cursor=pointer]
                    - button "i4, empty" [ref=e182] [cursor=pointer]
                    - button "j4, empty" [ref=e183] [cursor=pointer]
                    - button "k4, empty" [ref=e184] [cursor=pointer]
                    - button "2W, l4, double word, empty" [ref=e185] [cursor=pointer]:
                      - generic [ref=e186]: 2W
                    - button "m4, empty" [ref=e187] [cursor=pointer]
                    - button "2L, n4, double letter, empty" [ref=e188] [cursor=pointer]:
                      - generic [ref=e189]: 2L
                    - button "o4, empty" [ref=e190] [cursor=pointer]
                    - generic [ref=e191]: "5"
                    - button "3W, a5, triple word, empty" [ref=e192] [cursor=pointer]:
                      - generic [ref=e193]: 3W
                    - button "b5, empty" [ref=e194] [cursor=pointer]
                    - button "3L, c5, triple letter, empty" [ref=e195] [cursor=pointer]:
                      - generic [ref=e196]: 3L
                    - button "d5, empty" [ref=e197] [cursor=pointer]
                    - button "e5, empty" [ref=e198] [cursor=pointer]
                    - button "f5, empty" [ref=e199] [cursor=pointer]
                    - button "2L, g5, double letter, empty" [ref=e200] [cursor=pointer]:
                      - generic [ref=e201]: 2L
                    - button "h5, empty" [ref=e202] [cursor=pointer]
                    - button "2L, i5, double letter, empty" [ref=e203] [cursor=pointer]:
                      - generic [ref=e204]: 2L
                    - button "j5, empty" [ref=e205] [cursor=pointer]
                    - button "k5, empty" [ref=e206] [cursor=pointer]
                    - button "l5, empty" [ref=e207] [cursor=pointer]
                    - button "3L, m5, triple letter, empty" [ref=e208] [cursor=pointer]:
                      - generic [ref=e209]: 3L
                    - button "n5, empty" [ref=e210] [cursor=pointer]
                    - button "3W, o5, triple word, empty" [ref=e211] [cursor=pointer]:
                      - generic [ref=e212]: 3W
                    - generic [ref=e213]: "6"
                    - button "a6, empty" [ref=e214] [cursor=pointer]
                    - button "b6, empty" [ref=e215] [cursor=pointer]
                    - button "c6, empty" [ref=e216] [cursor=pointer]
                    - button "d6, empty" [ref=e217] [cursor=pointer]
                    - button "e6, empty" [ref=e218] [cursor=pointer]
                    - button "f6, empty" [ref=e219] [cursor=pointer]
                    - button "g6, empty" [ref=e220] [cursor=pointer]
                    - button "3L, h6, triple letter, empty" [ref=e221] [cursor=pointer]:
                      - generic [ref=e222]: 3L
                    - button "i6, empty" [ref=e223] [cursor=pointer]
                    - button "j6, empty" [ref=e224] [cursor=pointer]
                    - button "k6, empty" [ref=e225] [cursor=pointer]
                    - button "l6, empty" [ref=e226] [cursor=pointer]
                    - button "m6, empty" [ref=e227] [cursor=pointer]
                    - button "n6, empty" [ref=e228] [cursor=pointer]
                    - button "o6, empty" [ref=e229] [cursor=pointer]
                    - generic [ref=e230]: "7"
                    - button "a7, empty" [ref=e231] [cursor=pointer]
                    - button "2W, b7, double word, empty" [ref=e232] [cursor=pointer]:
                      - generic [ref=e233]: 2W
                    - button "c7, empty" [ref=e234] [cursor=pointer]
                    - button "d7, empty" [ref=e235] [cursor=pointer]
                    - button "2L, e7, double letter, empty" [ref=e236] [cursor=pointer]:
                      - generic [ref=e237]: 2L
                    - button "f7, empty" [ref=e238] [cursor=pointer]
                    - button "2L, g7, double letter, empty" [ref=e239] [cursor=pointer]:
                      - generic [ref=e240]: 2L
                    - button "h7, empty" [ref=e241] [cursor=pointer]
                    - button "2L, i7, double letter, empty" [ref=e242] [cursor=pointer]:
                      - generic [ref=e243]: 2L
                    - button "j7, empty" [ref=e244] [cursor=pointer]
                    - button "2L, k7, double letter, empty" [ref=e245] [cursor=pointer]:
                      - generic [ref=e246]: 2L
                    - button "l7, empty" [ref=e247] [cursor=pointer]
                    - button "m7, empty" [ref=e248] [cursor=pointer]
                    - button "2W, n7, double word, empty" [ref=e249] [cursor=pointer]:
                      - generic [ref=e250]: 2W
                    - button "o7, empty" [ref=e251] [cursor=pointer]
                    - generic [ref=e252]: "8"
                    - button "2L, a8, double letter, empty" [ref=e253] [cursor=pointer]:
                      - generic [ref=e254]: 2L
                    - button "b8, empty" [ref=e255] [cursor=pointer]
                    - button "c8, empty" [ref=e256] [cursor=pointer]
                    - button "d8, empty" [ref=e257] [cursor=pointer]
                    - button "e8, empty" [ref=e258] [cursor=pointer]
                    - button "3L, f8, triple letter, empty" [ref=e259] [cursor=pointer]:
                      - generic [ref=e260]: 3L
                    - button "g8, empty" [ref=e261] [cursor=pointer]
                    - button "★, h8, start, double word, empty" [ref=e262] [cursor=pointer]:
                      - generic [ref=e263]: ★
                    - button "i8, empty" [ref=e264] [cursor=pointer]
                    - button "3L, j8, triple letter, empty" [ref=e265] [cursor=pointer]:
                      - generic [ref=e266]: 3L
                    - button "k8, empty" [ref=e267] [cursor=pointer]
                    - button "l8, empty" [ref=e268] [cursor=pointer]
                    - button "m8, empty" [ref=e269] [cursor=pointer]
                    - button "n8, empty" [ref=e270] [cursor=pointer]
                    - button "2L, o8, double letter, empty" [ref=e271] [cursor=pointer]:
                      - generic [ref=e272]: 2L
                    - generic [ref=e273]: "9"
                    - button "a9, empty" [ref=e274] [cursor=pointer]
                    - button "2W, b9, double word, empty" [ref=e275] [cursor=pointer]:
                      - generic [ref=e276]: 2W
                    - button "c9, empty" [ref=e277] [cursor=pointer]
                    - button "d9, empty" [ref=e278] [cursor=pointer]
                    - button "2L, e9, double letter, empty" [ref=e279] [cursor=pointer]:
                      - generic [ref=e280]: 2L
                    - button "f9, empty" [ref=e281] [cursor=pointer]
                    - button "2L, g9, double letter, empty" [ref=e282] [cursor=pointer]:
                      - generic [ref=e283]: 2L
                    - button "h9, empty" [ref=e284] [cursor=pointer]
                    - button "2L, i9, double letter, empty" [ref=e285] [cursor=pointer]:
                      - generic [ref=e286]: 2L
                    - button "j9, empty" [ref=e287] [cursor=pointer]
                    - button "2L, k9, double letter, empty" [ref=e288] [cursor=pointer]:
                      - generic [ref=e289]: 2L
                    - button "l9, empty" [ref=e290] [cursor=pointer]
                    - button "m9, empty" [ref=e291] [cursor=pointer]
                    - button "2W, n9, double word, empty" [ref=e292] [cursor=pointer]:
                      - generic [ref=e293]: 2W
                    - button "o9, empty" [ref=e294] [cursor=pointer]
                    - generic [ref=e295]: "10"
                    - button "a10, empty" [ref=e296] [cursor=pointer]
                    - button "b10, empty" [ref=e297] [cursor=pointer]
                    - button "c10, empty" [ref=e298] [cursor=pointer]
                    - button "d10, empty" [ref=e299] [cursor=pointer]
                    - button "e10, empty" [ref=e300] [cursor=pointer]
                    - button "f10, empty" [ref=e301] [cursor=pointer]
                    - button "g10, empty" [ref=e302] [cursor=pointer]
                    - button "3L, h10, triple letter, empty" [ref=e303] [cursor=pointer]:
                      - generic [ref=e304]: 3L
                    - button "i10, empty" [ref=e305] [cursor=pointer]
                    - button "j10, empty" [ref=e306] [cursor=pointer]
                    - button "k10, empty" [ref=e307] [cursor=pointer]
                    - button "l10, empty" [ref=e308] [cursor=pointer]
                    - button "m10, empty" [ref=e309] [cursor=pointer]
                    - button "n10, empty" [ref=e310] [cursor=pointer]
                    - button "o10, empty" [ref=e311] [cursor=pointer]
                    - generic [ref=e312]: "11"
                    - button "3W, a11, triple word, empty" [ref=e313] [cursor=pointer]:
                      - generic [ref=e314]: 3W
                    - button "b11, empty" [ref=e315] [cursor=pointer]
                    - button "3L, c11, triple letter, empty" [ref=e316] [cursor=pointer]:
                      - generic [ref=e317]: 3L
                    - button "d11, empty" [ref=e318] [cursor=pointer]
                    - button "e11, empty" [ref=e319] [cursor=pointer]
                    - button "f11, empty" [ref=e320] [cursor=pointer]
                    - button "2L, g11, double letter, empty" [ref=e321] [cursor=pointer]:
                      - generic [ref=e322]: 2L
                    - button "h11, empty" [ref=e323] [cursor=pointer]
                    - button "2L, i11, double letter, empty" [ref=e324] [cursor=pointer]:
                      - generic [ref=e325]: 2L
                    - button "j11, empty" [ref=e326] [cursor=pointer]
                    - button "k11, empty" [ref=e327] [cursor=pointer]
                    - button "l11, empty" [ref=e328] [cursor=pointer]
                    - button "3L, m11, triple letter, empty" [ref=e329] [cursor=pointer]:
                      - generic [ref=e330]: 3L
                    - button "n11, empty" [ref=e331] [cursor=pointer]
                    - button "3W, o11, triple word, empty" [ref=e332] [cursor=pointer]:
                      - generic [ref=e333]: 3W
                    - generic [ref=e334]: "12"
                    - button "a12, empty" [ref=e335] [cursor=pointer]
                    - button "2L, b12, double letter, empty" [ref=e336] [cursor=pointer]:
                      - generic [ref=e337]: 2L
                    - button "c12, empty" [ref=e338] [cursor=pointer]
                    - button "2W, d12, double word, empty" [ref=e339] [cursor=pointer]:
                      - generic [ref=e340]: 2W
                    - button "e12, empty" [ref=e341] [cursor=pointer]
                    - button "f12, empty" [ref=e342] [cursor=pointer]
                    - button "g12, empty" [ref=e343] [cursor=pointer]
                    - button "h12, empty" [ref=e344] [cursor=pointer]
                    - button "i12, empty" [ref=e345] [cursor=pointer]
                    - button "j12, empty" [ref=e346] [cursor=pointer]
                    - button "k12, empty" [ref=e347] [cursor=pointer]
                    - button "2W, l12, double word, empty" [ref=e348] [cursor=pointer]:
                      - generic [ref=e349]: 2W
                    - button "m12, empty" [ref=e350] [cursor=pointer]
                    - button "2L, n12, double letter, empty" [ref=e351] [cursor=pointer]:
                      - generic [ref=e352]: 2L
                    - button "o12, empty" [ref=e353] [cursor=pointer]
                    - generic [ref=e354]: "13"
                    - button "a13, empty" [ref=e355] [cursor=pointer]
                    - button "b13, empty" [ref=e356] [cursor=pointer]
                    - button "c13, empty" [ref=e357] [cursor=pointer]
                    - button "d13, empty" [ref=e358] [cursor=pointer]
                    - button "3L, e13, triple letter, empty" [ref=e359] [cursor=pointer]:
                      - generic [ref=e360]: 3L
                    - button "f13, empty" [ref=e361] [cursor=pointer]
                    - button "g13, empty" [ref=e362] [cursor=pointer]
                    - button "h13, empty" [ref=e363] [cursor=pointer]
                    - button "i13, empty" [ref=e364] [cursor=pointer]
                    - button "j13, empty" [ref=e365] [cursor=pointer]
                    - button "3L, k13, triple letter, empty" [ref=e366] [cursor=pointer]:
                      - generic [ref=e367]: 3L
                    - button "l13, empty" [ref=e368] [cursor=pointer]
                    - button "m13, empty" [ref=e369] [cursor=pointer]
                    - button "n13, empty" [ref=e370] [cursor=pointer]
                    - button "o13, empty" [ref=e371] [cursor=pointer]
                    - generic [ref=e372]: "14"
                    - button "a14, empty" [ref=e373] [cursor=pointer]
                    - button "b14, empty" [ref=e374] [cursor=pointer]
                    - button "c14, empty" [ref=e375] [cursor=pointer]
                    - button "2L, d14, double letter, empty" [ref=e376] [cursor=pointer]:
                      - generic [ref=e377]: 2L
                    - button "e14, empty" [ref=e378] [cursor=pointer]
                    - button "f14, empty" [ref=e379] [cursor=pointer]
                    - button "2W, g14, double word, empty" [ref=e380] [cursor=pointer]:
                      - generic [ref=e381]: 2W
                    - button "h14, empty" [ref=e382] [cursor=pointer]
                    - button "2W, i14, double word, empty" [ref=e383] [cursor=pointer]:
                      - generic [ref=e384]: 2W
                    - button "j14, empty" [ref=e385] [cursor=pointer]
                    - button "k14, empty" [ref=e386] [cursor=pointer]
                    - button "2L, l14, double letter, empty" [ref=e387] [cursor=pointer]:
                      - generic [ref=e388]: 2L
                    - button "m14, empty" [ref=e389] [cursor=pointer]
                    - button "n14, empty" [ref=e390] [cursor=pointer]
                    - button "o14, empty" [ref=e391] [cursor=pointer]
                    - generic [ref=e392]: "15"
                    - button "2L, a15, double letter, empty" [ref=e393] [cursor=pointer]:
                      - generic [ref=e394]: 2L
                    - button "b15, empty" [ref=e395] [cursor=pointer]
                    - button "c15, empty" [ref=e396] [cursor=pointer]
                    - button "d15, empty" [ref=e397] [cursor=pointer]
                    - button "3W, e15, triple word, empty" [ref=e398] [cursor=pointer]:
                      - generic [ref=e399]: 3W
                    - button "f15, empty" [ref=e400] [cursor=pointer]
                    - button "g15, empty" [ref=e401] [cursor=pointer]
                    - button "2L, h15, double letter, empty" [ref=e402] [cursor=pointer]:
                      - generic [ref=e403]: 2L
                    - button "i15, empty" [ref=e404] [cursor=pointer]
                    - button "j15, empty" [ref=e405] [cursor=pointer]
                    - button "3W, k15, triple word, empty" [ref=e406] [cursor=pointer]:
                      - generic [ref=e407]: 3W
                    - button "l15, empty" [ref=e408] [cursor=pointer]
                    - button "m15, empty" [ref=e409] [cursor=pointer]
                    - button "n15, empty" [ref=e410] [cursor=pointer]
                    - button "2L, o15, double letter, empty" [ref=e411] [cursor=pointer]:
                      - generic [ref=e412]: 2L
                - 'button "Board map: locate a square" [ref=e413] [cursor=pointer]':
                  - img "Whole board overview; outline shows the enlarged area" [ref=e414]
                  - generic [ref=e641]: Map
          - status [ref=e643]:
            - generic [ref=e644]:
              - generic [ref=e645]: "Amber: avery. Teal: jordan_plays."
              - text: Amber — to play · 86 tiles in the bag
          - generic [ref=e648]:
            - generic [ref=e652]:
              - generic [ref=e653]:
                - img "Amber" [ref=e654]
                - generic "avery" [ref=e657]
                - generic [ref=e658]: Your move
              - generic [ref=e661]: 7 tiles
            - generic [ref=e662]:
              - generic [ref=e663]: Score
              - generic [ref=e664]: "0"
        - region "Game record" [ref=e667]:
          - generic [ref=e668]:
            - heading "Game record" [level=2] [ref=e670]
            - paragraph [ref=e671]: Amber — to play · 86 tiles in the bag
          - generic [ref=e673]:
            - group "Game actions" [ref=e674]:
              - button "Offer draw" [ref=e675] [cursor=pointer]:
                - paragraph [ref=e678]: Offer draw
              - button "Resign game" [ref=e679] [cursor=pointer]:
                - paragraph [ref=e682]:
                  - text: Resign
                  - generic [ref=e683]: game
            - button "History and stats" [ref=e684] [cursor=pointer]:
              - paragraph [ref=e687]: History and stats
  - dialog "Board map" [ref=e690]:
    - generic [ref=e696]:
      - generic [ref=e698]:
        - heading "Board map" [level=2] [ref=e699]
        - button "Close" [active] [ref=e700] [cursor=pointer]:
          - img [ref=e703]
      - generic [ref=e707]:
        - paragraph [ref=e708]: Choose a square to view on the enlarged board. This does not place a tile.
        - generic [ref=e709]:
          - status [ref=e710]: ★, h8, start, double word, empty
          - region "Scrollable word board" [ref=e712]:
            - group "Whole board locator" [ref=e713]:
              - generic [ref=e715]: a
              - generic [ref=e716]: b
              - generic [ref=e717]: c
              - generic [ref=e718]: d
              - generic [ref=e719]: e
              - generic [ref=e720]: f
              - generic [ref=e721]: g
              - generic [ref=e722]: h
              - generic [ref=e723]: i
              - generic [ref=e724]: j
              - generic [ref=e725]: k
              - generic [ref=e726]: l
              - generic [ref=e727]: m
              - generic [ref=e728]: "n"
              - generic [ref=e729]: o
              - generic [ref=e730]: "1"
              - button "2L, a1, double letter, empty" [ref=e731] [cursor=pointer]:
                - generic [ref=e732]: 2L
              - button "b1, empty" [ref=e733] [cursor=pointer]
              - button "c1, empty" [ref=e734] [cursor=pointer]
              - button "d1, empty" [ref=e735] [cursor=pointer]
              - button "3W, e1, triple word, empty" [ref=e736] [cursor=pointer]:
                - generic [ref=e737]: 3W
              - button "f1, empty" [ref=e738] [cursor=pointer]
              - button "g1, empty" [ref=e739] [cursor=pointer]
              - button "2L, h1, double letter, empty" [ref=e740] [cursor=pointer]:
                - generic [ref=e741]: 2L
              - button "i1, empty" [ref=e742] [cursor=pointer]
              - button "j1, empty" [ref=e743] [cursor=pointer]
              - button "3W, k1, triple word, empty" [ref=e744] [cursor=pointer]:
                - generic [ref=e745]: 3W
              - button "l1, empty" [ref=e746] [cursor=pointer]
              - button "m1, empty" [ref=e747] [cursor=pointer]
              - button "n1, empty" [ref=e748] [cursor=pointer]
              - button "2L, o1, double letter, empty" [ref=e749] [cursor=pointer]:
                - generic [ref=e750]: 2L
              - generic [ref=e751]: "2"
              - button "a2, empty" [ref=e752] [cursor=pointer]
              - button "b2, empty" [ref=e753] [cursor=pointer]
              - button "c2, empty" [ref=e754] [cursor=pointer]
              - button "2L, d2, double letter, empty" [ref=e755] [cursor=pointer]:
                - generic [ref=e756]: 2L
              - button "e2, empty" [ref=e757] [cursor=pointer]
              - button "f2, empty" [ref=e758] [cursor=pointer]
              - button "2W, g2, double word, empty" [ref=e759] [cursor=pointer]:
                - generic [ref=e760]: 2W
              - button "h2, empty" [ref=e761] [cursor=pointer]
              - button "2W, i2, double word, empty" [ref=e762] [cursor=pointer]:
                - generic [ref=e763]: 2W
              - button "j2, empty" [ref=e764] [cursor=pointer]
              - button "k2, empty" [ref=e765] [cursor=pointer]
              - button "2L, l2, double letter, empty" [ref=e766] [cursor=pointer]:
                - generic [ref=e767]: 2L
              - button "m2, empty" [ref=e768] [cursor=pointer]
              - button "n2, empty" [ref=e769] [cursor=pointer]
              - button "o2, empty" [ref=e770] [cursor=pointer]
              - generic [ref=e771]: "3"
              - button "a3, empty" [ref=e772] [cursor=pointer]
              - button "b3, empty" [ref=e773] [cursor=pointer]
              - button "c3, empty" [ref=e774] [cursor=pointer]
              - button "d3, empty" [ref=e775] [cursor=pointer]
              - button "3L, e3, triple letter, empty" [ref=e776] [cursor=pointer]:
                - generic [ref=e777]: 3L
              - button "f3, empty" [ref=e778] [cursor=pointer]
              - button "g3, empty" [ref=e779] [cursor=pointer]
              - button "h3, empty" [ref=e780] [cursor=pointer]
              - button "i3, empty" [ref=e781] [cursor=pointer]
              - button "j3, empty" [ref=e782] [cursor=pointer]
              - button "3L, k3, triple letter, empty" [ref=e783] [cursor=pointer]:
                - generic [ref=e784]: 3L
              - button "l3, empty" [ref=e785] [cursor=pointer]
              - button "m3, empty" [ref=e786] [cursor=pointer]
              - button "n3, empty" [ref=e787] [cursor=pointer]
              - button "o3, empty" [ref=e788] [cursor=pointer]
              - generic [ref=e789]: "4"
              - button "a4, empty" [ref=e790] [cursor=pointer]
              - button "2L, b4, double letter, empty" [ref=e791] [cursor=pointer]:
                - generic [ref=e792]: 2L
              - button "c4, empty" [ref=e793] [cursor=pointer]
              - button "2W, d4, double word, empty" [ref=e794] [cursor=pointer]:
                - generic [ref=e795]: 2W
              - button "e4, empty" [ref=e796] [cursor=pointer]
              - button "f4, empty" [ref=e797] [cursor=pointer]
              - button "g4, empty" [ref=e798] [cursor=pointer]
              - button "h4, empty" [ref=e799] [cursor=pointer]
              - button "i4, empty" [ref=e800] [cursor=pointer]
              - button "j4, empty" [ref=e801] [cursor=pointer]
              - button "k4, empty" [ref=e802] [cursor=pointer]
              - button "2W, l4, double word, empty" [ref=e803] [cursor=pointer]:
                - generic [ref=e804]: 2W
              - button "m4, empty" [ref=e805] [cursor=pointer]
              - button "2L, n4, double letter, empty" [ref=e806] [cursor=pointer]:
                - generic [ref=e807]: 2L
              - button "o4, empty" [ref=e808] [cursor=pointer]
              - generic [ref=e809]: "5"
              - button "3W, a5, triple word, empty" [ref=e810] [cursor=pointer]:
                - generic [ref=e811]: 3W
              - button "b5, empty" [ref=e812] [cursor=pointer]
              - button "3L, c5, triple letter, empty" [ref=e813] [cursor=pointer]:
                - generic [ref=e814]: 3L
              - button "d5, empty" [ref=e815] [cursor=pointer]
              - button "e5, empty" [ref=e816] [cursor=pointer]
              - button "f5, empty" [ref=e817] [cursor=pointer]
              - button "2L, g5, double letter, empty" [ref=e818] [cursor=pointer]:
                - generic [ref=e819]: 2L
              - button "h5, empty" [ref=e820] [cursor=pointer]
              - button "2L, i5, double letter, empty" [ref=e821] [cursor=pointer]:
                - generic [ref=e822]: 2L
              - button "j5, empty" [ref=e823] [cursor=pointer]
              - button "k5, empty" [ref=e824] [cursor=pointer]
              - button "l5, empty" [ref=e825] [cursor=pointer]
              - button "3L, m5, triple letter, empty" [ref=e826] [cursor=pointer]:
                - generic [ref=e827]: 3L
              - button "n5, empty" [ref=e828] [cursor=pointer]
              - button "3W, o5, triple word, empty" [ref=e829] [cursor=pointer]:
                - generic [ref=e830]: 3W
              - generic [ref=e831]: "6"
              - button "a6, empty" [ref=e832] [cursor=pointer]
              - button "b6, empty" [ref=e833] [cursor=pointer]
              - button "c6, empty" [ref=e834] [cursor=pointer]
              - button "d6, empty" [ref=e835] [cursor=pointer]
              - button "e6, empty" [ref=e836] [cursor=pointer]
              - button "f6, empty" [ref=e837] [cursor=pointer]
              - button "g6, empty" [ref=e838] [cursor=pointer]
              - button "3L, h6, triple letter, empty" [ref=e839] [cursor=pointer]:
                - generic [ref=e840]: 3L
              - button "i6, empty" [ref=e841] [cursor=pointer]
              - button "j6, empty" [ref=e842] [cursor=pointer]
              - button "k6, empty" [ref=e843] [cursor=pointer]
              - button "l6, empty" [ref=e844] [cursor=pointer]
              - button "m6, empty" [ref=e845] [cursor=pointer]
              - button "n6, empty" [ref=e846] [cursor=pointer]
              - button "o6, empty" [ref=e847] [cursor=pointer]
              - generic [ref=e848]: "7"
              - button "a7, empty" [ref=e849] [cursor=pointer]
              - button "2W, b7, double word, empty" [ref=e850] [cursor=pointer]:
                - generic [ref=e851]: 2W
              - button "c7, empty" [ref=e852] [cursor=pointer]
              - button "d7, empty" [ref=e853] [cursor=pointer]
              - button "2L, e7, double letter, empty" [ref=e854] [cursor=pointer]:
                - generic [ref=e855]: 2L
              - button "f7, empty" [ref=e856] [cursor=pointer]
              - button "2L, g7, double letter, empty" [ref=e857] [cursor=pointer]:
                - generic [ref=e858]: 2L
              - button "h7, empty" [ref=e859] [cursor=pointer]
              - button "2L, i7, double letter, empty" [ref=e860] [cursor=pointer]:
                - generic [ref=e861]: 2L
              - button "j7, empty" [ref=e862] [cursor=pointer]
              - button "2L, k7, double letter, empty" [ref=e863] [cursor=pointer]:
                - generic [ref=e864]: 2L
              - button "l7, empty" [ref=e865] [cursor=pointer]
              - button "m7, empty" [ref=e866] [cursor=pointer]
              - button "2W, n7, double word, empty" [ref=e867] [cursor=pointer]:
                - generic [ref=e868]: 2W
              - button "o7, empty" [ref=e869] [cursor=pointer]
              - generic [ref=e870]: "8"
              - button "2L, a8, double letter, empty" [ref=e871] [cursor=pointer]:
                - generic [ref=e872]: 2L
              - button "b8, empty" [ref=e873] [cursor=pointer]
              - button "c8, empty" [ref=e874] [cursor=pointer]
              - button "d8, empty" [ref=e875] [cursor=pointer]
              - button "e8, empty" [ref=e876] [cursor=pointer]
              - button "3L, f8, triple letter, empty" [ref=e877] [cursor=pointer]:
                - generic [ref=e878]: 3L
              - button "g8, empty" [ref=e879] [cursor=pointer]
              - button "★, h8, start, double word, empty" [ref=e880] [cursor=pointer]:
                - generic [ref=e881]: ★
              - button "i8, empty" [ref=e882] [cursor=pointer]
              - button "3L, j8, triple letter, empty" [ref=e883] [cursor=pointer]:
                - generic [ref=e884]: 3L
              - button "k8, empty" [ref=e885] [cursor=pointer]
              - button "l8, empty" [ref=e886] [cursor=pointer]
              - button "m8, empty" [ref=e887] [cursor=pointer]
              - button "n8, empty" [ref=e888] [cursor=pointer]
              - button "2L, o8, double letter, empty" [ref=e889] [cursor=pointer]:
                - generic [ref=e890]: 2L
              - generic [ref=e891]: "9"
              - button "a9, empty" [ref=e892] [cursor=pointer]
              - button "2W, b9, double word, empty" [ref=e893] [cursor=pointer]:
                - generic [ref=e894]: 2W
              - button "c9, empty" [ref=e895] [cursor=pointer]
              - button "d9, empty" [ref=e896] [cursor=pointer]
              - button "2L, e9, double letter, empty" [ref=e897] [cursor=pointer]:
                - generic [ref=e898]: 2L
              - button "f9, empty" [ref=e899] [cursor=pointer]
              - button "2L, g9, double letter, empty" [ref=e900] [cursor=pointer]:
                - generic [ref=e901]: 2L
              - button "h9, empty" [ref=e902] [cursor=pointer]
              - button "2L, i9, double letter, empty" [ref=e903] [cursor=pointer]:
                - generic [ref=e904]: 2L
              - button "j9, empty" [ref=e905] [cursor=pointer]
              - button "2L, k9, double letter, empty" [ref=e906] [cursor=pointer]:
                - generic [ref=e907]: 2L
              - button "l9, empty" [ref=e908] [cursor=pointer]
              - button "m9, empty" [ref=e909] [cursor=pointer]
              - button "2W, n9, double word, empty" [ref=e910] [cursor=pointer]:
                - generic [ref=e911]: 2W
              - button "o9, empty" [ref=e912] [cursor=pointer]
              - generic [ref=e913]: "10"
              - button "a10, empty" [ref=e914] [cursor=pointer]
              - button "b10, empty" [ref=e915] [cursor=pointer]
              - button "c10, empty" [ref=e916] [cursor=pointer]
              - button "d10, empty" [ref=e917] [cursor=pointer]
              - button "e10, empty" [ref=e918] [cursor=pointer]
              - button "f10, empty" [ref=e919] [cursor=pointer]
              - button "g10, empty" [ref=e920] [cursor=pointer]
              - button "3L, h10, triple letter, empty" [ref=e921] [cursor=pointer]:
                - generic [ref=e922]: 3L
              - button "i10, empty" [ref=e923] [cursor=pointer]
              - button "j10, empty" [ref=e924] [cursor=pointer]
              - button "k10, empty" [ref=e925] [cursor=pointer]
              - button "l10, empty" [ref=e926] [cursor=pointer]
              - button "m10, empty" [ref=e927] [cursor=pointer]
              - button "n10, empty" [ref=e928] [cursor=pointer]
              - button "o10, empty" [ref=e929] [cursor=pointer]
              - generic [ref=e930]: "11"
              - button "3W, a11, triple word, empty" [ref=e931] [cursor=pointer]:
                - generic [ref=e932]: 3W
              - button "b11, empty" [ref=e933] [cursor=pointer]
              - button "3L, c11, triple letter, empty" [ref=e934] [cursor=pointer]:
                - generic [ref=e935]: 3L
              - button "d11, empty" [ref=e936] [cursor=pointer]
              - button "e11, empty" [ref=e937] [cursor=pointer]
              - button "f11, empty" [ref=e938] [cursor=pointer]
              - button "2L, g11, double letter, empty" [ref=e939] [cursor=pointer]:
                - generic [ref=e940]: 2L
              - button "h11, empty" [ref=e941] [cursor=pointer]
              - button "2L, i11, double letter, empty" [ref=e942] [cursor=pointer]:
                - generic [ref=e943]: 2L
              - button "j11, empty" [ref=e944] [cursor=pointer]
              - button "k11, empty" [ref=e945] [cursor=pointer]
              - button "l11, empty" [ref=e946] [cursor=pointer]
              - button "3L, m11, triple letter, empty" [ref=e947] [cursor=pointer]:
                - generic [ref=e948]: 3L
              - button "n11, empty" [ref=e949] [cursor=pointer]
              - button "3W, o11, triple word, empty" [ref=e950] [cursor=pointer]:
                - generic [ref=e951]: 3W
              - generic [ref=e952]: "12"
              - button "a12, empty" [ref=e953] [cursor=pointer]
              - button "2L, b12, double letter, empty" [ref=e954] [cursor=pointer]:
                - generic [ref=e955]: 2L
              - button "c12, empty" [ref=e956] [cursor=pointer]
              - button "2W, d12, double word, empty" [ref=e957] [cursor=pointer]:
                - generic [ref=e958]: 2W
              - button "e12, empty" [ref=e959] [cursor=pointer]
              - button "f12, empty" [ref=e960] [cursor=pointer]
              - button "g12, empty" [ref=e961] [cursor=pointer]
              - button "h12, empty" [ref=e962] [cursor=pointer]
              - button "i12, empty" [ref=e963] [cursor=pointer]
              - button "j12, empty" [ref=e964] [cursor=pointer]
              - button "k12, empty" [ref=e965] [cursor=pointer]
              - button "2W, l12, double word, empty" [ref=e966] [cursor=pointer]:
                - generic [ref=e967]: 2W
              - button "m12, empty" [ref=e968] [cursor=pointer]
              - button "2L, n12, double letter, empty" [ref=e969] [cursor=pointer]:
                - generic [ref=e970]: 2L
              - button "o12, empty" [ref=e971] [cursor=pointer]
              - generic [ref=e972]: "13"
              - button "a13, empty" [ref=e973] [cursor=pointer]
              - button "b13, empty" [ref=e974] [cursor=pointer]
              - button "c13, empty" [ref=e975] [cursor=pointer]
              - button "d13, empty" [ref=e976] [cursor=pointer]
              - button "3L, e13, triple letter, empty" [ref=e977] [cursor=pointer]:
                - generic [ref=e978]: 3L
              - button "f13, empty" [ref=e979] [cursor=pointer]
              - button "g13, empty" [ref=e980] [cursor=pointer]
              - button "h13, empty" [ref=e981] [cursor=pointer]
              - button "i13, empty" [ref=e982] [cursor=pointer]
              - button "j13, empty" [ref=e983] [cursor=pointer]
              - button "3L, k13, triple letter, empty" [ref=e984] [cursor=pointer]:
                - generic [ref=e985]: 3L
              - button "l13, empty" [ref=e986] [cursor=pointer]
              - button "m13, empty" [ref=e987] [cursor=pointer]
              - button "n13, empty" [ref=e988] [cursor=pointer]
              - button "o13, empty" [ref=e989] [cursor=pointer]
              - generic [ref=e990]: "14"
              - button "a14, empty" [ref=e991] [cursor=pointer]
              - button "b14, empty" [ref=e992] [cursor=pointer]
              - button "c14, empty" [ref=e993] [cursor=pointer]
              - button "2L, d14, double letter, empty" [ref=e994] [cursor=pointer]:
                - generic [ref=e995]: 2L
              - button "e14, empty" [ref=e996] [cursor=pointer]
              - button "f14, empty" [ref=e997] [cursor=pointer]
              - button "2W, g14, double word, empty" [ref=e998] [cursor=pointer]:
                - generic [ref=e999]: 2W
              - button "h14, empty" [ref=e1000] [cursor=pointer]
              - button "2W, i14, double word, empty" [ref=e1001] [cursor=pointer]:
                - generic [ref=e1002]: 2W
              - button "j14, empty" [ref=e1003] [cursor=pointer]
              - button "k14, empty" [ref=e1004] [cursor=pointer]
              - button "2L, l14, double letter, empty" [ref=e1005] [cursor=pointer]:
                - generic [ref=e1006]: 2L
              - button "m14, empty" [ref=e1007] [cursor=pointer]
              - button "n14, empty" [ref=e1008] [cursor=pointer]
              - button "o14, empty" [ref=e1009] [cursor=pointer]
              - generic [ref=e1010]: "15"
              - button "2L, a15, double letter, empty" [ref=e1011] [cursor=pointer]:
                - generic [ref=e1012]: 2L
              - button "b15, empty" [ref=e1013] [cursor=pointer]
              - button "c15, empty" [ref=e1014] [cursor=pointer]
              - button "d15, empty" [ref=e1015] [cursor=pointer]
              - button "3W, e15, triple word, empty" [ref=e1016] [cursor=pointer]:
                - generic [ref=e1017]: 3W
              - button "f15, empty" [ref=e1018] [cursor=pointer]
              - button "g15, empty" [ref=e1019] [cursor=pointer]
              - button "2L, h15, double letter, empty" [ref=e1020] [cursor=pointer]:
                - generic [ref=e1021]: 2L
              - button "i15, empty" [ref=e1022] [cursor=pointer]
              - button "j15, empty" [ref=e1023] [cursor=pointer]
              - button "3W, k15, triple word, empty" [ref=e1024] [cursor=pointer]:
                - generic [ref=e1025]: 3W
              - button "l15, empty" [ref=e1026] [cursor=pointer]
              - button "m15, empty" [ref=e1027] [cursor=pointer]
              - button "n15, empty" [ref=e1028] [cursor=pointer]
              - button "2L, o15, double letter, empty" [ref=e1029] [cursor=pointer]:
                - generic [ref=e1030]: 2L
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