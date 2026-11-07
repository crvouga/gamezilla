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
Received: "error: expected false to be true // Object.is equality"

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
          - generic [ref=e186]:
            - generic [ref=e187]:
              - button "Fit board" [pressed] [ref=e188] [cursor=pointer]:
                - paragraph [ref=e191]: Fit board
              - button "Enlarge board" [ref=e192] [cursor=pointer]:
                - paragraph [ref=e195]: Enlarge board
            - region "Scrollable word board" [ref=e197]:
              - group "Word board, fifteen columns and fifteen rows" [ref=e198]:
                - generic [ref=e200]: a
                - generic [ref=e201]: b
                - generic [ref=e202]: c
                - generic [ref=e203]: d
                - generic [ref=e204]: e
                - generic [ref=e205]: f
                - generic [ref=e206]: g
                - generic [ref=e207]: h
                - generic [ref=e208]: i
                - generic [ref=e209]: j
                - generic [ref=e210]: k
                - generic [ref=e211]: l
                - generic [ref=e212]: m
                - generic [ref=e213]: "n"
                - generic [ref=e214]: o
                - generic [ref=e215]: "1"
                - button "2L, a1, double letter, empty" [ref=e216] [cursor=pointer]:
                  - generic [ref=e217]: 2L
                - button "b1, empty" [ref=e218] [cursor=pointer]
                - button "c1, empty" [ref=e219] [cursor=pointer]
                - button "d1, empty" [ref=e220] [cursor=pointer]
                - button "3W, e1, triple word, empty" [ref=e221] [cursor=pointer]:
                  - generic [ref=e222]: 3W
                - button "f1, empty" [ref=e223] [cursor=pointer]
                - button "g1, empty" [ref=e224] [cursor=pointer]
                - button "2L, h1, double letter, empty" [ref=e225] [cursor=pointer]:
                  - generic [ref=e226]: 2L
                - button "i1, empty" [ref=e227] [cursor=pointer]
                - button "j1, empty" [ref=e228] [cursor=pointer]
                - button "3W, k1, triple word, empty" [ref=e229] [cursor=pointer]:
                  - generic [ref=e230]: 3W
                - button "l1, empty" [ref=e231] [cursor=pointer]
                - button "m1, empty" [ref=e232] [cursor=pointer]
                - button "n1, empty" [ref=e233] [cursor=pointer]
                - button "2L, o1, double letter, empty" [ref=e234] [cursor=pointer]:
                  - generic [ref=e235]: 2L
                - generic [ref=e236]: "2"
                - button "a2, empty" [ref=e237] [cursor=pointer]
                - button "b2, empty" [ref=e238] [cursor=pointer]
                - button "c2, empty" [ref=e239] [cursor=pointer]
                - button "2L, d2, double letter, empty" [ref=e240] [cursor=pointer]:
                  - generic [ref=e241]: 2L
                - button "e2, empty" [ref=e242] [cursor=pointer]
                - button "f2, empty" [ref=e243] [cursor=pointer]
                - button "2W, g2, double word, empty" [ref=e244] [cursor=pointer]:
                  - generic [ref=e245]: 2W
                - button "h2, empty" [ref=e246] [cursor=pointer]
                - button "2W, i2, double word, empty" [ref=e247] [cursor=pointer]:
                  - generic [ref=e248]: 2W
                - button "j2, empty" [ref=e249] [cursor=pointer]
                - button "k2, empty" [ref=e250] [cursor=pointer]
                - button "2L, l2, double letter, empty" [ref=e251] [cursor=pointer]:
                  - generic [ref=e252]: 2L
                - button "m2, empty" [ref=e253] [cursor=pointer]
                - button "n2, empty" [ref=e254] [cursor=pointer]
                - button "o2, empty" [ref=e255] [cursor=pointer]
                - generic [ref=e256]: "3"
                - button "a3, empty" [ref=e257] [cursor=pointer]
                - button "b3, empty" [ref=e258] [cursor=pointer]
                - button "c3, empty" [ref=e259] [cursor=pointer]
                - button "d3, empty" [ref=e260] [cursor=pointer]
                - button "3L, e3, triple letter, empty" [ref=e261] [cursor=pointer]:
                  - generic [ref=e262]: 3L
                - button "f3, empty" [ref=e263] [cursor=pointer]
                - button "g3, empty" [ref=e264] [cursor=pointer]
                - button "h3, empty" [ref=e265] [cursor=pointer]
                - button "i3, empty" [ref=e266] [cursor=pointer]
                - button "j3, empty" [ref=e267] [cursor=pointer]
                - button "3L, k3, triple letter, empty" [ref=e268] [cursor=pointer]:
                  - generic [ref=e269]: 3L
                - button "l3, empty" [ref=e270] [cursor=pointer]
                - button "m3, empty" [ref=e271] [cursor=pointer]
                - button "n3, empty" [ref=e272] [cursor=pointer]
                - button "o3, empty" [ref=e273] [cursor=pointer]
                - generic [ref=e274]: "4"
                - button "a4, empty" [ref=e275] [cursor=pointer]
                - button "2L, b4, double letter, empty" [ref=e276] [cursor=pointer]:
                  - generic [ref=e277]: 2L
                - button "c4, empty" [ref=e278] [cursor=pointer]
                - button "2W, d4, double word, empty" [ref=e279] [cursor=pointer]:
                  - generic [ref=e280]: 2W
                - button "e4, empty" [ref=e281] [cursor=pointer]
                - button "f4, empty" [ref=e282] [cursor=pointer]
                - button "g4, empty" [ref=e283] [cursor=pointer]
                - button "h4, empty" [ref=e284] [cursor=pointer]
                - button "i4, empty" [ref=e285] [cursor=pointer]
                - button "j4, empty" [ref=e286] [cursor=pointer]
                - button "k4, empty" [ref=e287] [cursor=pointer]
                - button "2W, l4, double word, empty" [ref=e288] [cursor=pointer]:
                  - generic [ref=e289]: 2W
                - button "m4, empty" [ref=e290] [cursor=pointer]
                - button "2L, n4, double letter, empty" [ref=e291] [cursor=pointer]:
                  - generic [ref=e292]: 2L
                - button "o4, empty" [ref=e293] [cursor=pointer]
                - generic [ref=e294]: "5"
                - button "3W, a5, triple word, empty" [ref=e295] [cursor=pointer]:
                  - generic [ref=e296]: 3W
                - button "b5, empty" [ref=e297] [cursor=pointer]
                - button "3L, c5, triple letter, empty" [ref=e298] [cursor=pointer]:
                  - generic [ref=e299]: 3L
                - button "d5, empty" [ref=e300] [cursor=pointer]
                - button "e5, empty" [ref=e301] [cursor=pointer]
                - button "f5, empty" [ref=e302] [cursor=pointer]
                - button "2L, g5, double letter, empty" [ref=e303] [cursor=pointer]:
                  - generic [ref=e304]: 2L
                - button "h5, empty" [ref=e305] [cursor=pointer]
                - button "2L, i5, double letter, empty" [ref=e306] [cursor=pointer]:
                  - generic [ref=e307]: 2L
                - button "j5, empty" [ref=e308] [cursor=pointer]
                - button "k5, empty" [ref=e309] [cursor=pointer]
                - button "l5, empty" [ref=e310] [cursor=pointer]
                - button "3L, m5, triple letter, empty" [ref=e311] [cursor=pointer]:
                  - generic [ref=e312]: 3L
                - button "n5, empty" [ref=e313] [cursor=pointer]
                - button "3W, o5, triple word, empty" [ref=e314] [cursor=pointer]:
                  - generic [ref=e315]: 3W
                - generic [ref=e316]: "6"
                - button "a6, empty" [ref=e317] [cursor=pointer]
                - button "b6, empty" [ref=e318] [cursor=pointer]
                - button "c6, empty" [ref=e319] [cursor=pointer]
                - button "d6, empty" [ref=e320] [cursor=pointer]
                - button "e6, empty" [ref=e321] [cursor=pointer]
                - button "f6, empty" [ref=e322] [cursor=pointer]
                - button "g6, empty" [ref=e323] [cursor=pointer]
                - button "3L, h6, triple letter, empty" [ref=e324] [cursor=pointer]:
                  - generic [ref=e325]: 3L
                - button "i6, empty" [ref=e326] [cursor=pointer]
                - button "j6, empty" [ref=e327] [cursor=pointer]
                - button "k6, empty" [ref=e328] [cursor=pointer]
                - button "l6, empty" [ref=e329] [cursor=pointer]
                - button "m6, empty" [ref=e330] [cursor=pointer]
                - button "n6, empty" [ref=e331] [cursor=pointer]
                - button "o6, empty" [ref=e332] [cursor=pointer]
                - generic [ref=e333]: "7"
                - button "a7, empty" [ref=e334] [cursor=pointer]
                - button "2W, b7, double word, empty" [ref=e335] [cursor=pointer]:
                  - generic [ref=e336]: 2W
                - button "c7, empty" [ref=e337] [cursor=pointer]
                - button "d7, empty" [ref=e338] [cursor=pointer]
                - button "2L, e7, double letter, empty" [ref=e339] [cursor=pointer]:
                  - generic [ref=e340]: 2L
                - button "f7, empty" [ref=e341] [cursor=pointer]
                - button "2L, g7, double letter, empty" [ref=e342] [cursor=pointer]:
                  - generic [ref=e343]: 2L
                - button "h7, empty" [ref=e344] [cursor=pointer]
                - button "2L, i7, double letter, empty" [ref=e345] [cursor=pointer]:
                  - generic [ref=e346]: 2L
                - button "j7, empty" [ref=e347] [cursor=pointer]
                - button "2L, k7, double letter, empty" [ref=e348] [cursor=pointer]:
                  - generic [ref=e349]: 2L
                - button "l7, empty" [ref=e350] [cursor=pointer]
                - button "m7, empty" [ref=e351] [cursor=pointer]
                - button "2W, n7, double word, empty" [ref=e352] [cursor=pointer]:
                  - generic [ref=e353]: 2W
                - button "o7, empty" [ref=e354] [cursor=pointer]
                - generic [ref=e355]: "8"
                - button "2L, a8, double letter, empty" [ref=e356] [cursor=pointer]:
                  - generic [ref=e357]: 2L
                - button "b8, empty" [ref=e358] [cursor=pointer]
                - button "c8, empty" [ref=e359] [cursor=pointer]
                - button "d8, empty" [ref=e360] [cursor=pointer]
                - button "e8, empty" [ref=e361] [cursor=pointer]
                - button "3L, f8, triple letter, empty" [ref=e362] [cursor=pointer]:
                  - generic [ref=e363]: 3L
                - button "g8, empty" [ref=e364] [cursor=pointer]
                - button "A 0, h8, your tentative blank as A" [ref=e365] [cursor=pointer]:
                  - generic [ref=e366]: A
                  - generic [ref=e367]: "0"
                - button "i8, empty" [ref=e368] [cursor=pointer]
                - button "3L, j8, triple letter, empty" [ref=e369] [cursor=pointer]:
                  - generic [ref=e370]: 3L
                - button "k8, empty" [ref=e371] [cursor=pointer]
                - button "l8, empty" [ref=e372] [cursor=pointer]
                - button "m8, empty" [ref=e373] [cursor=pointer]
                - button "n8, empty" [ref=e374] [cursor=pointer]
                - button "2L, o8, double letter, empty" [ref=e375] [cursor=pointer]:
                  - generic [ref=e376]: 2L
                - generic [ref=e377]: "9"
                - button "a9, empty" [ref=e378] [cursor=pointer]
                - button "2W, b9, double word, empty" [ref=e379] [cursor=pointer]:
                  - generic [ref=e380]: 2W
                - button "c9, empty" [ref=e381] [cursor=pointer]
                - button "d9, empty" [ref=e382] [cursor=pointer]
                - button "2L, e9, double letter, empty" [ref=e383] [cursor=pointer]:
                  - generic [ref=e384]: 2L
                - button "f9, empty" [ref=e385] [cursor=pointer]
                - button "2L, g9, double letter, empty" [ref=e386] [cursor=pointer]:
                  - generic [ref=e387]: 2L
                - button "h9, empty" [ref=e388] [cursor=pointer]
                - button "2L, i9, double letter, empty" [ref=e389] [cursor=pointer]:
                  - generic [ref=e390]: 2L
                - button "j9, empty" [ref=e391] [cursor=pointer]
                - button "2L, k9, double letter, empty" [ref=e392] [cursor=pointer]:
                  - generic [ref=e393]: 2L
                - button "l9, empty" [ref=e394] [cursor=pointer]
                - button "m9, empty" [ref=e395] [cursor=pointer]
                - button "2W, n9, double word, empty" [ref=e396] [cursor=pointer]:
                  - generic [ref=e397]: 2W
                - button "o9, empty" [ref=e398] [cursor=pointer]
                - generic [ref=e399]: "10"
                - button "a10, empty" [ref=e400] [cursor=pointer]
                - button "b10, empty" [ref=e401] [cursor=pointer]
                - button "c10, empty" [ref=e402] [cursor=pointer]
                - button "d10, empty" [ref=e403] [cursor=pointer]
                - button "e10, empty" [ref=e404] [cursor=pointer]
                - button "f10, empty" [ref=e405] [cursor=pointer]
                - button "g10, empty" [ref=e406] [cursor=pointer]
                - button "3L, h10, triple letter, empty" [ref=e407] [cursor=pointer]:
                  - generic [ref=e408]: 3L
                - button "i10, empty" [ref=e409] [cursor=pointer]
                - button "j10, empty" [ref=e410] [cursor=pointer]
                - button "k10, empty" [ref=e411] [cursor=pointer]
                - button "l10, empty" [ref=e412] [cursor=pointer]
                - button "m10, empty" [ref=e413] [cursor=pointer]
                - button "n10, empty" [ref=e414] [cursor=pointer]
                - button "o10, empty" [ref=e415] [cursor=pointer]
                - generic [ref=e416]: "11"
                - button "3W, a11, triple word, empty" [ref=e417] [cursor=pointer]:
                  - generic [ref=e418]: 3W
                - button "b11, empty" [ref=e419] [cursor=pointer]
                - button "3L, c11, triple letter, empty" [ref=e420] [cursor=pointer]:
                  - generic [ref=e421]: 3L
                - button "d11, empty" [ref=e422] [cursor=pointer]
                - button "e11, empty" [ref=e423] [cursor=pointer]
                - button "f11, empty" [ref=e424] [cursor=pointer]
                - button "2L, g11, double letter, empty" [ref=e425] [cursor=pointer]:
                  - generic [ref=e426]: 2L
                - button "h11, empty" [ref=e427] [cursor=pointer]
                - button "2L, i11, double letter, empty" [ref=e428] [cursor=pointer]:
                  - generic [ref=e429]: 2L
                - button "j11, empty" [ref=e430] [cursor=pointer]
                - button "k11, empty" [ref=e431] [cursor=pointer]
                - button "l11, empty" [ref=e432] [cursor=pointer]
                - button "3L, m11, triple letter, empty" [ref=e433] [cursor=pointer]:
                  - generic [ref=e434]: 3L
                - button "n11, empty" [ref=e435] [cursor=pointer]
                - button "3W, o11, triple word, empty" [ref=e436] [cursor=pointer]:
                  - generic [ref=e437]: 3W
                - generic [ref=e438]: "12"
                - button "a12, empty" [ref=e439] [cursor=pointer]
                - button "2L, b12, double letter, empty" [ref=e440] [cursor=pointer]:
                  - generic [ref=e441]: 2L
                - button "c12, empty" [ref=e442] [cursor=pointer]
                - button "2W, d12, double word, empty" [ref=e443] [cursor=pointer]:
                  - generic [ref=e444]: 2W
                - button "e12, empty" [ref=e445] [cursor=pointer]
                - button "f12, empty" [ref=e446] [cursor=pointer]
                - button "g12, empty" [ref=e447] [cursor=pointer]
                - button "h12, empty" [ref=e448] [cursor=pointer]
                - button "i12, empty" [ref=e449] [cursor=pointer]
                - button "j12, empty" [ref=e450] [cursor=pointer]
                - button "k12, empty" [ref=e451] [cursor=pointer]
                - button "2W, l12, double word, empty" [ref=e452] [cursor=pointer]:
                  - generic [ref=e453]: 2W
                - button "m12, empty" [ref=e454] [cursor=pointer]
                - button "2L, n12, double letter, empty" [ref=e455] [cursor=pointer]:
                  - generic [ref=e456]: 2L
                - button "o12, empty" [ref=e457] [cursor=pointer]
                - generic [ref=e458]: "13"
                - button "a13, empty" [ref=e459] [cursor=pointer]
                - button "b13, empty" [ref=e460] [cursor=pointer]
                - button "c13, empty" [ref=e461] [cursor=pointer]
                - button "d13, empty" [ref=e462] [cursor=pointer]
                - button "3L, e13, triple letter, empty" [ref=e463] [cursor=pointer]:
                  - generic [ref=e464]: 3L
                - button "f13, empty" [ref=e465] [cursor=pointer]
                - button "g13, empty" [ref=e466] [cursor=pointer]
                - button "h13, empty" [ref=e467] [cursor=pointer]
                - button "i13, empty" [ref=e468] [cursor=pointer]
                - button "j13, empty" [ref=e469] [cursor=pointer]
                - button "3L, k13, triple letter, empty" [ref=e470] [cursor=pointer]:
                  - generic [ref=e471]: 3L
                - button "l13, empty" [ref=e472] [cursor=pointer]
                - button "m13, empty" [ref=e473] [cursor=pointer]
                - button "n13, empty" [ref=e474] [cursor=pointer]
                - button "o13, empty" [ref=e475] [cursor=pointer]
                - generic [ref=e476]: "14"
                - button "a14, empty" [ref=e477] [cursor=pointer]
                - button "b14, empty" [ref=e478] [cursor=pointer]
                - button "c14, empty" [ref=e479] [cursor=pointer]
                - button "2L, d14, double letter, empty" [ref=e480] [cursor=pointer]:
                  - generic [ref=e481]: 2L
                - button "e14, empty" [ref=e482] [cursor=pointer]
                - button "f14, empty" [ref=e483] [cursor=pointer]
                - button "2W, g14, double word, empty" [ref=e484] [cursor=pointer]:
                  - generic [ref=e485]: 2W
                - button "h14, empty" [ref=e486] [cursor=pointer]
                - button "2W, i14, double word, empty" [ref=e487] [cursor=pointer]:
                  - generic [ref=e488]: 2W
                - button "j14, empty" [ref=e489] [cursor=pointer]
                - button "k14, empty" [ref=e490] [cursor=pointer]
                - button "2L, l14, double letter, empty" [ref=e491] [cursor=pointer]:
                  - generic [ref=e492]: 2L
                - button "m14, empty" [ref=e493] [cursor=pointer]
                - button "n14, empty" [ref=e494] [cursor=pointer]
                - button "o14, empty" [ref=e495] [cursor=pointer]
                - generic [ref=e496]: "15"
                - button "2L, a15, double letter, empty" [ref=e497] [cursor=pointer]:
                  - generic [ref=e498]: 2L
                - button "b15, empty" [ref=e499] [cursor=pointer]
                - button "c15, empty" [ref=e500] [cursor=pointer]
                - button "d15, empty" [ref=e501] [cursor=pointer]
                - button "3W, e15, triple word, empty" [ref=e502] [cursor=pointer]:
                  - generic [ref=e503]: 3W
                - button "f15, empty" [ref=e504] [cursor=pointer]
                - button "g15, empty" [ref=e505] [cursor=pointer]
                - button "2L, h15, double letter, empty" [ref=e506] [cursor=pointer]:
                  - generic [ref=e507]: 2L
                - button "i15, empty" [ref=e508] [cursor=pointer]
                - button "j15, empty" [ref=e509] [cursor=pointer]
                - button "3W, k15, triple word, empty" [ref=e510] [cursor=pointer]:
                  - generic [ref=e511]: 3W
                - button "l15, empty" [ref=e512] [cursor=pointer]
                - button "m15, empty" [ref=e513] [cursor=pointer]
                - button "n15, empty" [ref=e514] [cursor=pointer]
                - button "2L, o15, double letter, empty" [ref=e515] [cursor=pointer]:
                  - generic [ref=e516]: 2L
        - status [ref=e518]:
          - generic [ref=e519]:
            - generic [ref=e520]: "Amber: avery. Teal: jordan_plays."
            - text: Amber — to play · 86 tiles in the bag
        - generic [ref=e523]:
          - generic [ref=e527]:
            - generic [ref=e528]:
              - img "Amber" [ref=e529]
              - generic "avery" [ref=e532]
              - generic [ref=e533]: Your move
            - generic [ref=e536]: 7 tiles
          - generic [ref=e537]:
            - generic [ref=e538]: Score
            - generic [ref=e539]: "0"
      - region "Game record" [ref=e542]:
        - generic [ref=e543]:
          - heading "Game record" [level=2] [ref=e545]
          - paragraph [ref=e546]: Amber — to play · 86 tiles in the bag
        - generic [ref=e548]:
          - group "Game actions" [ref=e549]:
            - button "Offer draw" [ref=e550] [cursor=pointer]:
              - paragraph [ref=e553]: Offer draw
            - button "Resign game" [ref=e554] [cursor=pointer]:
              - paragraph [ref=e557]:
                - text: Resign
                - generic [ref=e558]: game
          - button "History and stats" [ref=e559] [cursor=pointer]:
            - paragraph [ref=e562]: History and stats
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