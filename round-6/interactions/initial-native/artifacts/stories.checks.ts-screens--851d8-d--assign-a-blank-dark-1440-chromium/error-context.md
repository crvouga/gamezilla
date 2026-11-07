# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--assign-a-blank dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

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
            - button "Blank, 0 points, on the board" [disabled] [ref=e57]
            - button "E, 1 points" [ref=e58] [cursor=pointer]:
              - generic [ref=e59]: E
              - generic [ref=e60]: "1"
            - button "S, 1 points" [ref=e61] [cursor=pointer]:
              - generic [ref=e62]: S
              - generic [ref=e63]: "1"
            - button "Q, 10 points" [ref=e64] [cursor=pointer]:
              - generic [ref=e65]: Q
              - generic [ref=e66]: "10"
          - generic [ref=e67]:
            - group "Word actions" [ref=e69]:
              - button "Play word" [disabled] [ref=e70]:
                - paragraph [ref=e73]: Play word
              - button "Pass, exchange & tools" [ref=e74] [cursor=pointer]:
                - paragraph [ref=e77]: Pass, exchange & tools
            - generic [ref=e78]:
              - generic [ref=e79]:
                - paragraph [ref=e80]: Choose the letter your blank plays
                - group "Choose the letter your blank plays" [ref=e81]:
                  - button "A" [active] [ref=e82] [cursor=pointer]:
                    - paragraph [ref=e85]: A
                  - button "B" [ref=e86] [cursor=pointer]:
                    - paragraph [ref=e89]: B
                  - button "C" [ref=e90] [cursor=pointer]:
                    - paragraph [ref=e93]: C
                  - button "D" [ref=e94] [cursor=pointer]:
                    - paragraph [ref=e97]: D
                  - button "E" [ref=e98] [cursor=pointer]:
                    - paragraph [ref=e101]: E
                  - button "F" [ref=e102] [cursor=pointer]:
                    - paragraph [ref=e105]: F
                  - button "G" [ref=e106] [cursor=pointer]:
                    - paragraph [ref=e109]: G
                  - button "H" [ref=e110] [cursor=pointer]:
                    - paragraph [ref=e113]: H
                  - button "I" [ref=e114] [cursor=pointer]:
                    - paragraph [ref=e117]: I
                  - button "J" [ref=e118] [cursor=pointer]:
                    - paragraph [ref=e121]: J
                  - button "K" [ref=e122] [cursor=pointer]:
                    - paragraph [ref=e125]: K
                  - button "L" [ref=e126] [cursor=pointer]:
                    - paragraph [ref=e129]: L
                  - button "M" [ref=e130] [cursor=pointer]:
                    - paragraph [ref=e133]: M
                  - button "N" [ref=e134] [cursor=pointer]:
                    - paragraph [ref=e137]: "N"
                  - button "O" [ref=e138] [cursor=pointer]:
                    - paragraph [ref=e141]: O
                  - button "P" [ref=e142] [cursor=pointer]:
                    - paragraph [ref=e145]: P
                  - button "Q" [ref=e146] [cursor=pointer]:
                    - paragraph [ref=e149]: Q
                  - button "R" [ref=e150] [cursor=pointer]:
                    - paragraph [ref=e153]: R
                  - button "S" [ref=e154] [cursor=pointer]:
                    - paragraph [ref=e157]: S
                  - button "T" [ref=e158] [cursor=pointer]:
                    - paragraph [ref=e161]: T
                  - button "U" [ref=e162] [cursor=pointer]:
                    - paragraph [ref=e165]: U
                  - button "V" [ref=e166] [cursor=pointer]:
                    - paragraph [ref=e169]: V
                  - button "W" [ref=e170] [cursor=pointer]:
                    - paragraph [ref=e173]: W
                  - button "X" [ref=e174] [cursor=pointer]:
                    - paragraph [ref=e177]: X
                  - button "Y" [ref=e178] [cursor=pointer]:
                    - paragraph [ref=e181]: "Y"
                  - button "Z" [ref=e182] [cursor=pointer]:
                    - paragraph [ref=e185]: Z
              - status [ref=e187]: Choose the letter your blank plays.
          - generic [ref=e188]:
            - generic [ref=e189]:
              - button "Fit board" [pressed] [ref=e190] [cursor=pointer]:
                - paragraph [ref=e193]: Fit board
              - button "Enlarge board" [ref=e194] [cursor=pointer]:
                - paragraph [ref=e197]: Enlarge board
            - region "Scrollable word board" [ref=e199]:
              - group "Word board, fifteen columns and fifteen rows" [ref=e200]:
                - generic [ref=e202]: a
                - generic [ref=e203]: b
                - generic [ref=e204]: c
                - generic [ref=e205]: d
                - generic [ref=e206]: e
                - generic [ref=e207]: f
                - generic [ref=e208]: g
                - generic [ref=e209]: h
                - generic [ref=e210]: i
                - generic [ref=e211]: j
                - generic [ref=e212]: k
                - generic [ref=e213]: l
                - generic [ref=e214]: m
                - generic [ref=e215]: "n"
                - generic [ref=e216]: o
                - generic [ref=e217]: "1"
                - button "2L, a1, double letter, empty" [ref=e218] [cursor=pointer]:
                  - generic [ref=e219]: 2L
                - button "b1, empty" [ref=e220] [cursor=pointer]
                - button "c1, empty" [ref=e221] [cursor=pointer]
                - button "d1, empty" [ref=e222] [cursor=pointer]
                - button "3W, e1, triple word, empty" [ref=e223] [cursor=pointer]:
                  - generic [ref=e224]: 3W
                - button "f1, empty" [ref=e225] [cursor=pointer]
                - button "g1, empty" [ref=e226] [cursor=pointer]
                - button "2L, h1, double letter, empty" [ref=e227] [cursor=pointer]:
                  - generic [ref=e228]: 2L
                - button "i1, empty" [ref=e229] [cursor=pointer]
                - button "j1, empty" [ref=e230] [cursor=pointer]
                - button "3W, k1, triple word, empty" [ref=e231] [cursor=pointer]:
                  - generic [ref=e232]: 3W
                - button "l1, empty" [ref=e233] [cursor=pointer]
                - button "m1, empty" [ref=e234] [cursor=pointer]
                - button "n1, empty" [ref=e235] [cursor=pointer]
                - button "2L, o1, double letter, empty" [ref=e236] [cursor=pointer]:
                  - generic [ref=e237]: 2L
                - generic [ref=e238]: "2"
                - button "a2, empty" [ref=e239] [cursor=pointer]
                - button "b2, empty" [ref=e240] [cursor=pointer]
                - button "c2, empty" [ref=e241] [cursor=pointer]
                - button "2L, d2, double letter, empty" [ref=e242] [cursor=pointer]:
                  - generic [ref=e243]: 2L
                - button "e2, empty" [ref=e244] [cursor=pointer]
                - button "f2, empty" [ref=e245] [cursor=pointer]
                - button "2W, g2, double word, empty" [ref=e246] [cursor=pointer]:
                  - generic [ref=e247]: 2W
                - button "h2, empty" [ref=e248] [cursor=pointer]
                - button "2W, i2, double word, empty" [ref=e249] [cursor=pointer]:
                  - generic [ref=e250]: 2W
                - button "j2, empty" [ref=e251] [cursor=pointer]
                - button "k2, empty" [ref=e252] [cursor=pointer]
                - button "2L, l2, double letter, empty" [ref=e253] [cursor=pointer]:
                  - generic [ref=e254]: 2L
                - button "m2, empty" [ref=e255] [cursor=pointer]
                - button "n2, empty" [ref=e256] [cursor=pointer]
                - button "o2, empty" [ref=e257] [cursor=pointer]
                - generic [ref=e258]: "3"
                - button "a3, empty" [ref=e259] [cursor=pointer]
                - button "b3, empty" [ref=e260] [cursor=pointer]
                - button "c3, empty" [ref=e261] [cursor=pointer]
                - button "d3, empty" [ref=e262] [cursor=pointer]
                - button "3L, e3, triple letter, empty" [ref=e263] [cursor=pointer]:
                  - generic [ref=e264]: 3L
                - button "f3, empty" [ref=e265] [cursor=pointer]
                - button "g3, empty" [ref=e266] [cursor=pointer]
                - button "h3, empty" [ref=e267] [cursor=pointer]
                - button "i3, empty" [ref=e268] [cursor=pointer]
                - button "j3, empty" [ref=e269] [cursor=pointer]
                - button "3L, k3, triple letter, empty" [ref=e270] [cursor=pointer]:
                  - generic [ref=e271]: 3L
                - button "l3, empty" [ref=e272] [cursor=pointer]
                - button "m3, empty" [ref=e273] [cursor=pointer]
                - button "n3, empty" [ref=e274] [cursor=pointer]
                - button "o3, empty" [ref=e275] [cursor=pointer]
                - generic [ref=e276]: "4"
                - button "a4, empty" [ref=e277] [cursor=pointer]
                - button "2L, b4, double letter, empty" [ref=e278] [cursor=pointer]:
                  - generic [ref=e279]: 2L
                - button "c4, empty" [ref=e280] [cursor=pointer]
                - button "2W, d4, double word, empty" [ref=e281] [cursor=pointer]:
                  - generic [ref=e282]: 2W
                - button "e4, empty" [ref=e283] [cursor=pointer]
                - button "f4, empty" [ref=e284] [cursor=pointer]
                - button "g4, empty" [ref=e285] [cursor=pointer]
                - button "h4, empty" [ref=e286] [cursor=pointer]
                - button "i4, empty" [ref=e287] [cursor=pointer]
                - button "j4, empty" [ref=e288] [cursor=pointer]
                - button "k4, empty" [ref=e289] [cursor=pointer]
                - button "2W, l4, double word, empty" [ref=e290] [cursor=pointer]:
                  - generic [ref=e291]: 2W
                - button "m4, empty" [ref=e292] [cursor=pointer]
                - button "2L, n4, double letter, empty" [ref=e293] [cursor=pointer]:
                  - generic [ref=e294]: 2L
                - button "o4, empty" [ref=e295] [cursor=pointer]
                - generic [ref=e296]: "5"
                - button "3W, a5, triple word, empty" [ref=e297] [cursor=pointer]:
                  - generic [ref=e298]: 3W
                - button "b5, empty" [ref=e299] [cursor=pointer]
                - button "3L, c5, triple letter, empty" [ref=e300] [cursor=pointer]:
                  - generic [ref=e301]: 3L
                - button "d5, empty" [ref=e302] [cursor=pointer]
                - button "e5, empty" [ref=e303] [cursor=pointer]
                - button "f5, empty" [ref=e304] [cursor=pointer]
                - button "2L, g5, double letter, empty" [ref=e305] [cursor=pointer]:
                  - generic [ref=e306]: 2L
                - button "h5, empty" [ref=e307] [cursor=pointer]
                - button "2L, i5, double letter, empty" [ref=e308] [cursor=pointer]:
                  - generic [ref=e309]: 2L
                - button "j5, empty" [ref=e310] [cursor=pointer]
                - button "k5, empty" [ref=e311] [cursor=pointer]
                - button "l5, empty" [ref=e312] [cursor=pointer]
                - button "3L, m5, triple letter, empty" [ref=e313] [cursor=pointer]:
                  - generic [ref=e314]: 3L
                - button "n5, empty" [ref=e315] [cursor=pointer]
                - button "3W, o5, triple word, empty" [ref=e316] [cursor=pointer]:
                  - generic [ref=e317]: 3W
                - generic [ref=e318]: "6"
                - button "a6, empty" [ref=e319] [cursor=pointer]
                - button "b6, empty" [ref=e320] [cursor=pointer]
                - button "c6, empty" [ref=e321] [cursor=pointer]
                - button "d6, empty" [ref=e322] [cursor=pointer]
                - button "e6, empty" [ref=e323] [cursor=pointer]
                - button "f6, empty" [ref=e324] [cursor=pointer]
                - button "g6, empty" [ref=e325] [cursor=pointer]
                - button "3L, h6, triple letter, empty" [ref=e326] [cursor=pointer]:
                  - generic [ref=e327]: 3L
                - button "i6, empty" [ref=e328] [cursor=pointer]
                - button "j6, empty" [ref=e329] [cursor=pointer]
                - button "k6, empty" [ref=e330] [cursor=pointer]
                - button "l6, empty" [ref=e331] [cursor=pointer]
                - button "m6, empty" [ref=e332] [cursor=pointer]
                - button "n6, empty" [ref=e333] [cursor=pointer]
                - button "o6, empty" [ref=e334] [cursor=pointer]
                - generic [ref=e335]: "7"
                - button "a7, empty" [ref=e336] [cursor=pointer]
                - button "2W, b7, double word, empty" [ref=e337] [cursor=pointer]:
                  - generic [ref=e338]: 2W
                - button "c7, empty" [ref=e339] [cursor=pointer]
                - button "d7, empty" [ref=e340] [cursor=pointer]
                - button "2L, e7, double letter, empty" [ref=e341] [cursor=pointer]:
                  - generic [ref=e342]: 2L
                - button "f7, empty" [ref=e343] [cursor=pointer]
                - button "2L, g7, double letter, empty" [ref=e344] [cursor=pointer]:
                  - generic [ref=e345]: 2L
                - button "h7, empty" [ref=e346] [cursor=pointer]
                - button "2L, i7, double letter, empty" [ref=e347] [cursor=pointer]:
                  - generic [ref=e348]: 2L
                - button "j7, empty" [ref=e349] [cursor=pointer]
                - button "2L, k7, double letter, empty" [ref=e350] [cursor=pointer]:
                  - generic [ref=e351]: 2L
                - button "l7, empty" [ref=e352] [cursor=pointer]
                - button "m7, empty" [ref=e353] [cursor=pointer]
                - button "2W, n7, double word, empty" [ref=e354] [cursor=pointer]:
                  - generic [ref=e355]: 2W
                - button "o7, empty" [ref=e356] [cursor=pointer]
                - generic [ref=e357]: "8"
                - button "2L, a8, double letter, empty" [ref=e358] [cursor=pointer]:
                  - generic [ref=e359]: 2L
                - button "b8, empty" [ref=e360] [cursor=pointer]
                - button "c8, empty" [ref=e361] [cursor=pointer]
                - button "d8, empty" [ref=e362] [cursor=pointer]
                - button "e8, empty" [ref=e363] [cursor=pointer]
                - button "3L, f8, triple letter, empty" [ref=e364] [cursor=pointer]:
                  - generic [ref=e365]: 3L
                - button "g8, empty" [ref=e366] [cursor=pointer]
                - button "A 0, h8, your tentative blank as A" [ref=e367] [cursor=pointer]:
                  - generic [ref=e368]: A
                  - generic [ref=e369]: "0"
                - button "i8, empty" [ref=e370] [cursor=pointer]
                - button "3L, j8, triple letter, empty" [ref=e371] [cursor=pointer]:
                  - generic [ref=e372]: 3L
                - button "k8, empty" [ref=e373] [cursor=pointer]
                - button "l8, empty" [ref=e374] [cursor=pointer]
                - button "m8, empty" [ref=e375] [cursor=pointer]
                - button "n8, empty" [ref=e376] [cursor=pointer]
                - button "2L, o8, double letter, empty" [ref=e377] [cursor=pointer]:
                  - generic [ref=e378]: 2L
                - generic [ref=e379]: "9"
                - button "a9, empty" [ref=e380] [cursor=pointer]
                - button "2W, b9, double word, empty" [ref=e381] [cursor=pointer]:
                  - generic [ref=e382]: 2W
                - button "c9, empty" [ref=e383] [cursor=pointer]
                - button "d9, empty" [ref=e384] [cursor=pointer]
                - button "2L, e9, double letter, empty" [ref=e385] [cursor=pointer]:
                  - generic [ref=e386]: 2L
                - button "f9, empty" [ref=e387] [cursor=pointer]
                - button "2L, g9, double letter, empty" [ref=e388] [cursor=pointer]:
                  - generic [ref=e389]: 2L
                - button "h9, empty" [ref=e390] [cursor=pointer]
                - button "2L, i9, double letter, empty" [ref=e391] [cursor=pointer]:
                  - generic [ref=e392]: 2L
                - button "j9, empty" [ref=e393] [cursor=pointer]
                - button "2L, k9, double letter, empty" [ref=e394] [cursor=pointer]:
                  - generic [ref=e395]: 2L
                - button "l9, empty" [ref=e396] [cursor=pointer]
                - button "m9, empty" [ref=e397] [cursor=pointer]
                - button "2W, n9, double word, empty" [ref=e398] [cursor=pointer]:
                  - generic [ref=e399]: 2W
                - button "o9, empty" [ref=e400] [cursor=pointer]
                - generic [ref=e401]: "10"
                - button "a10, empty" [ref=e402] [cursor=pointer]
                - button "b10, empty" [ref=e403] [cursor=pointer]
                - button "c10, empty" [ref=e404] [cursor=pointer]
                - button "d10, empty" [ref=e405] [cursor=pointer]
                - button "e10, empty" [ref=e406] [cursor=pointer]
                - button "f10, empty" [ref=e407] [cursor=pointer]
                - button "g10, empty" [ref=e408] [cursor=pointer]
                - button "3L, h10, triple letter, empty" [ref=e409] [cursor=pointer]:
                  - generic [ref=e410]: 3L
                - button "i10, empty" [ref=e411] [cursor=pointer]
                - button "j10, empty" [ref=e412] [cursor=pointer]
                - button "k10, empty" [ref=e413] [cursor=pointer]
                - button "l10, empty" [ref=e414] [cursor=pointer]
                - button "m10, empty" [ref=e415] [cursor=pointer]
                - button "n10, empty" [ref=e416] [cursor=pointer]
                - button "o10, empty" [ref=e417] [cursor=pointer]
                - generic [ref=e418]: "11"
                - button "3W, a11, triple word, empty" [ref=e419] [cursor=pointer]:
                  - generic [ref=e420]: 3W
                - button "b11, empty" [ref=e421] [cursor=pointer]
                - button "3L, c11, triple letter, empty" [ref=e422] [cursor=pointer]:
                  - generic [ref=e423]: 3L
                - button "d11, empty" [ref=e424] [cursor=pointer]
                - button "e11, empty" [ref=e425] [cursor=pointer]
                - button "f11, empty" [ref=e426] [cursor=pointer]
                - button "2L, g11, double letter, empty" [ref=e427] [cursor=pointer]:
                  - generic [ref=e428]: 2L
                - button "h11, empty" [ref=e429] [cursor=pointer]
                - button "2L, i11, double letter, empty" [ref=e430] [cursor=pointer]:
                  - generic [ref=e431]: 2L
                - button "j11, empty" [ref=e432] [cursor=pointer]
                - button "k11, empty" [ref=e433] [cursor=pointer]
                - button "l11, empty" [ref=e434] [cursor=pointer]
                - button "3L, m11, triple letter, empty" [ref=e435] [cursor=pointer]:
                  - generic [ref=e436]: 3L
                - button "n11, empty" [ref=e437] [cursor=pointer]
                - button "3W, o11, triple word, empty" [ref=e438] [cursor=pointer]:
                  - generic [ref=e439]: 3W
                - generic [ref=e440]: "12"
                - button "a12, empty" [ref=e441] [cursor=pointer]
                - button "2L, b12, double letter, empty" [ref=e442] [cursor=pointer]:
                  - generic [ref=e443]: 2L
                - button "c12, empty" [ref=e444] [cursor=pointer]
                - button "2W, d12, double word, empty" [ref=e445] [cursor=pointer]:
                  - generic [ref=e446]: 2W
                - button "e12, empty" [ref=e447] [cursor=pointer]
                - button "f12, empty" [ref=e448] [cursor=pointer]
                - button "g12, empty" [ref=e449] [cursor=pointer]
                - button "h12, empty" [ref=e450] [cursor=pointer]
                - button "i12, empty" [ref=e451] [cursor=pointer]
                - button "j12, empty" [ref=e452] [cursor=pointer]
                - button "k12, empty" [ref=e453] [cursor=pointer]
                - button "2W, l12, double word, empty" [ref=e454] [cursor=pointer]:
                  - generic [ref=e455]: 2W
                - button "m12, empty" [ref=e456] [cursor=pointer]
                - button "2L, n12, double letter, empty" [ref=e457] [cursor=pointer]:
                  - generic [ref=e458]: 2L
                - button "o12, empty" [ref=e459] [cursor=pointer]
                - generic [ref=e460]: "13"
                - button "a13, empty" [ref=e461] [cursor=pointer]
                - button "b13, empty" [ref=e462] [cursor=pointer]
                - button "c13, empty" [ref=e463] [cursor=pointer]
                - button "d13, empty" [ref=e464] [cursor=pointer]
                - button "3L, e13, triple letter, empty" [ref=e465] [cursor=pointer]:
                  - generic [ref=e466]: 3L
                - button "f13, empty" [ref=e467] [cursor=pointer]
                - button "g13, empty" [ref=e468] [cursor=pointer]
                - button "h13, empty" [ref=e469] [cursor=pointer]
                - button "i13, empty" [ref=e470] [cursor=pointer]
                - button "j13, empty" [ref=e471] [cursor=pointer]
                - button "3L, k13, triple letter, empty" [ref=e472] [cursor=pointer]:
                  - generic [ref=e473]: 3L
                - button "l13, empty" [ref=e474] [cursor=pointer]
                - button "m13, empty" [ref=e475] [cursor=pointer]
                - button "n13, empty" [ref=e476] [cursor=pointer]
                - button "o13, empty" [ref=e477] [cursor=pointer]
                - generic [ref=e478]: "14"
                - button "a14, empty" [ref=e479] [cursor=pointer]
                - button "b14, empty" [ref=e480] [cursor=pointer]
                - button "c14, empty" [ref=e481] [cursor=pointer]
                - button "2L, d14, double letter, empty" [ref=e482] [cursor=pointer]:
                  - generic [ref=e483]: 2L
                - button "e14, empty" [ref=e484] [cursor=pointer]
                - button "f14, empty" [ref=e485] [cursor=pointer]
                - button "2W, g14, double word, empty" [ref=e486] [cursor=pointer]:
                  - generic [ref=e487]: 2W
                - button "h14, empty" [ref=e488] [cursor=pointer]
                - button "2W, i14, double word, empty" [ref=e489] [cursor=pointer]:
                  - generic [ref=e490]: 2W
                - button "j14, empty" [ref=e491] [cursor=pointer]
                - button "k14, empty" [ref=e492] [cursor=pointer]
                - button "2L, l14, double letter, empty" [ref=e493] [cursor=pointer]:
                  - generic [ref=e494]: 2L
                - button "m14, empty" [ref=e495] [cursor=pointer]
                - button "n14, empty" [ref=e496] [cursor=pointer]
                - button "o14, empty" [ref=e497] [cursor=pointer]
                - generic [ref=e498]: "15"
                - button "2L, a15, double letter, empty" [ref=e499] [cursor=pointer]:
                  - generic [ref=e500]: 2L
                - button "b15, empty" [ref=e501] [cursor=pointer]
                - button "c15, empty" [ref=e502] [cursor=pointer]
                - button "d15, empty" [ref=e503] [cursor=pointer]
                - button "3W, e15, triple word, empty" [ref=e504] [cursor=pointer]:
                  - generic [ref=e505]: 3W
                - button "f15, empty" [ref=e506] [cursor=pointer]
                - button "g15, empty" [ref=e507] [cursor=pointer]
                - button "2L, h15, double letter, empty" [ref=e508] [cursor=pointer]:
                  - generic [ref=e509]: 2L
                - button "i15, empty" [ref=e510] [cursor=pointer]
                - button "j15, empty" [ref=e511] [cursor=pointer]
                - button "3W, k15, triple word, empty" [ref=e512] [cursor=pointer]:
                  - generic [ref=e513]: 3W
                - button "l15, empty" [ref=e514] [cursor=pointer]
                - button "m15, empty" [ref=e515] [cursor=pointer]
                - button "n15, empty" [ref=e516] [cursor=pointer]
                - button "2L, o15, double letter, empty" [ref=e517] [cursor=pointer]:
                  - generic [ref=e518]: 2L
        - status [ref=e520]:
          - generic [ref=e521]:
            - generic [ref=e522]: "Amber: avery. Teal: jordan_plays."
            - text: Amber — to play · 86 tiles in the bag
        - generic [ref=e525]:
          - generic [ref=e529]:
            - generic [ref=e530]:
              - img "Amber" [ref=e531]
              - generic "avery" [ref=e534]
              - generic [ref=e535]: Your move
            - generic [ref=e538]: 7 tiles
          - generic [ref=e539]:
            - generic [ref=e540]: Score
            - generic [ref=e541]: "0"
      - region "Game record" [ref=e544]:
        - generic [ref=e545]:
          - heading "Game record" [level=2] [ref=e547]
          - paragraph [ref=e548]: Amber — to play · 86 tiles in the bag
        - generic [ref=e550]:
          - group "Game actions" [ref=e551]:
            - button "Offer draw" [ref=e552] [cursor=pointer]:
              - paragraph [ref=e555]: Offer draw
            - button "Resign game" [ref=e556] [cursor=pointer]:
              - paragraph [ref=e559]:
                - text: Resign
                - generic [ref=e560]: game
          - button "History and stats" [ref=e561] [cursor=pointer]:
            - paragraph [ref=e564]: History and stats
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