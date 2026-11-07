# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: word-tiles-round-five.checks.ts >> screens-games-word-tiles-board--enlarged-coordinates regression word-tiles-cramped-precision-window dark-1440
- Location: tests/storybook/word-tiles-round-five.checks.ts:26:5

# Error details

```
Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/enlarged-coordinates-dark-1440.png.
```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e9]:
    - generic [ref=e11]:
      - img "Unnamed App" [ref=e13]:
        - img [ref=e14]
        - generic [ref=e15]: Unnamed App
      - navigation "Navigation" [ref=e16]:
        - button "Spaces" [ref=e17] [cursor=pointer]:
          - img [ref=e19]
          - generic [ref=e21]: Spaces
        - button "Search" [ref=e22] [cursor=pointer]:
          - img [ref=e24]
          - generic [ref=e27]: Search
        - button "Notifications" [ref=e28] [cursor=pointer]:
          - img [ref=e30]
          - generic [ref=e33]: Notifications
        - button "Profile" [ref=e34] [cursor=pointer]:
          - img [ref=e36]
          - generic [ref=e39]: Profile
      - button "@avery, account menu" [ref=e43] [cursor=pointer]:
        - generic [ref=e46]: "@avery"
    - generic [ref=e50]:
      - generic [ref=e52]:
        - navigation "Breadcrumb" [ref=e55]:
          - list [ref=e56]:
            - listitem [ref=e57]:
              - generic [ref=e58]:
                - generic [ref=e59]: F
                - generic [ref=e60]: Friday game night
        - generic [ref=e63]:
          - button "People in this space" [ref=e65] [cursor=pointer]:
            - img [ref=e69]
          - button "Minimize space" [ref=e75] [cursor=pointer]:
            - img [ref=e79]
          - button "More" [ref=e83] [cursor=pointer]:
            - img [ref=e86]
      - generic [ref=e93]:
        - generic [ref=e94]:
          - heading "Word Tiles" [level=1] [ref=e97]
          - generic [ref=e99]:
            - generic [ref=e100]: Unrated
            - generic [ref=e101]: ·Untimed
        - generic [ref=e103]:
          - generic [ref=e105]:
            - generic [ref=e107]:
              - generic [ref=e111]:
                - generic [ref=e112]:
                  - img "Teal" [ref=e113]
                  - generic "jordan_plays" [ref=e116]
                - generic [ref=e119]: 7 tiles
              - generic [ref=e120]:
                - generic [ref=e121]: Score
                - generic [ref=e122]: "0"
            - generic [ref=e124]:
              - group "Your rack" [ref=e125]:
                - button "C, 3 points" [ref=e126] [cursor=pointer]:
                  - generic [ref=e127]: C
                  - generic [ref=e128]: "3"
                - button "A, 1 points" [ref=e129] [cursor=pointer]:
                  - generic [ref=e130]: A
                  - generic [ref=e131]: "1"
                - button "T, 1 points" [ref=e132] [cursor=pointer]:
                  - generic [ref=e133]: T
                  - generic [ref=e134]: "1"
                - button "Blank, 0 points" [ref=e135] [cursor=pointer]:
                  - generic [ref=e136]: "0"
                - button "E, 1 points" [ref=e137] [cursor=pointer]:
                  - generic [ref=e138]: E
                  - generic [ref=e139]: "1"
                - button "S, 1 points" [ref=e140] [cursor=pointer]:
                  - generic [ref=e141]: S
                  - generic [ref=e142]: "1"
                - button "Q, 10 points" [ref=e143] [cursor=pointer]:
                  - generic [ref=e144]: Q
                  - generic [ref=e145]: "10"
              - generic [ref=e146]:
                - group "Word actions" [ref=e148]:
                  - button "Play word" [disabled] [ref=e149]:
                    - paragraph [ref=e152]: Play word
                  - button "Pass, exchange & tools" [ref=e153] [cursor=pointer]:
                    - paragraph [ref=e156]: Pass, exchange & tools
                - status [ref=e159]: Choose a tile, then a square.
              - generic [ref=e161]:
                - region "Scrollable word board" [ref=e162]:
                  - group "Word board, fifteen columns and fifteen rows" [ref=e163]:
                    - generic [ref=e165]: a
                    - generic [ref=e166]: b
                    - generic [ref=e167]: c
                    - generic [ref=e168]: d
                    - generic [ref=e169]: e
                    - generic [ref=e170]: f
                    - generic [ref=e171]: g
                    - generic [ref=e172]: h
                    - generic [ref=e173]: i
                    - generic [ref=e174]: j
                    - generic [ref=e175]: k
                    - generic [ref=e176]: l
                    - generic [ref=e177]: m
                    - generic [ref=e178]: "n"
                    - generic [ref=e179]: o
                    - generic [ref=e180]: "1"
                    - button "2L, a1, double letter, empty" [ref=e181] [cursor=pointer]:
                      - generic [ref=e182]: 2L
                    - button "b1, empty" [ref=e183] [cursor=pointer]
                    - button "c1, empty" [ref=e184] [cursor=pointer]
                    - button "d1, empty" [ref=e185] [cursor=pointer]
                    - button "3W, e1, triple word, empty" [ref=e186] [cursor=pointer]:
                      - generic [ref=e187]: 3W
                    - button "f1, empty" [ref=e188] [cursor=pointer]
                    - button "g1, empty" [ref=e189] [cursor=pointer]
                    - button "2L, h1, double letter, empty" [ref=e190] [cursor=pointer]:
                      - generic [ref=e191]: 2L
                    - button "i1, empty" [ref=e192] [cursor=pointer]
                    - button "j1, empty" [ref=e193] [cursor=pointer]
                    - button "3W, k1, triple word, empty" [ref=e194] [cursor=pointer]:
                      - generic [ref=e195]: 3W
                    - button "l1, empty" [ref=e196] [cursor=pointer]
                    - button "m1, empty" [ref=e197] [cursor=pointer]
                    - button "n1, empty" [ref=e198] [cursor=pointer]
                    - button "2L, o1, double letter, empty" [ref=e199] [cursor=pointer]:
                      - generic [ref=e200]: 2L
                    - generic [ref=e201]: "2"
                    - button "a2, empty" [ref=e202] [cursor=pointer]
                    - button "b2, empty" [ref=e203] [cursor=pointer]
                    - button "c2, empty" [ref=e204] [cursor=pointer]
                    - button "2L, d2, double letter, empty" [ref=e205] [cursor=pointer]:
                      - generic [ref=e206]: 2L
                    - button "e2, empty" [ref=e207] [cursor=pointer]
                    - button "f2, empty" [ref=e208] [cursor=pointer]
                    - button "2W, g2, double word, empty" [ref=e209] [cursor=pointer]:
                      - generic [ref=e210]: 2W
                    - button "h2, empty" [ref=e211] [cursor=pointer]
                    - button "2W, i2, double word, empty" [ref=e212] [cursor=pointer]:
                      - generic [ref=e213]: 2W
                    - button "j2, empty" [ref=e214] [cursor=pointer]
                    - button "k2, empty" [ref=e215] [cursor=pointer]
                    - button "2L, l2, double letter, empty" [ref=e216] [cursor=pointer]:
                      - generic [ref=e217]: 2L
                    - button "m2, empty" [ref=e218] [cursor=pointer]
                    - button "n2, empty" [ref=e219] [cursor=pointer]
                    - button "o2, empty" [ref=e220] [cursor=pointer]
                    - generic [ref=e221]: "3"
                    - button "a3, empty" [ref=e222] [cursor=pointer]
                    - button "b3, empty" [ref=e223] [cursor=pointer]
                    - button "c3, empty" [ref=e224] [cursor=pointer]
                    - button "d3, empty" [ref=e225] [cursor=pointer]
                    - button "3L, e3, triple letter, empty" [ref=e226] [cursor=pointer]:
                      - generic [ref=e227]: 3L
                    - button "f3, empty" [ref=e228] [cursor=pointer]
                    - button "g3, empty" [ref=e229] [cursor=pointer]
                    - button "h3, empty" [ref=e230] [cursor=pointer]
                    - button "i3, empty" [ref=e231] [cursor=pointer]
                    - button "j3, empty" [ref=e232] [cursor=pointer]
                    - button "3L, k3, triple letter, empty" [ref=e233] [cursor=pointer]:
                      - generic [ref=e234]: 3L
                    - button "l3, empty" [ref=e235] [cursor=pointer]
                    - button "m3, empty" [ref=e236] [cursor=pointer]
                    - button "n3, empty" [ref=e237] [cursor=pointer]
                    - button "o3, empty" [ref=e238] [cursor=pointer]
                    - generic [ref=e239]: "4"
                    - button "a4, empty" [ref=e240] [cursor=pointer]
                    - button "2L, b4, double letter, empty" [ref=e241] [cursor=pointer]:
                      - generic [ref=e242]: 2L
                    - button "c4, empty" [ref=e243] [cursor=pointer]
                    - button "2W, d4, double word, empty" [ref=e244] [cursor=pointer]:
                      - generic [ref=e245]: 2W
                    - button "e4, empty" [ref=e246] [cursor=pointer]
                    - button "f4, empty" [ref=e247] [cursor=pointer]
                    - button "g4, empty" [ref=e248] [cursor=pointer]
                    - button "h4, empty" [ref=e249] [cursor=pointer]
                    - button "i4, empty" [ref=e250] [cursor=pointer]
                    - button "j4, empty" [ref=e251] [cursor=pointer]
                    - button "k4, empty" [ref=e252] [cursor=pointer]
                    - button "2W, l4, double word, empty" [ref=e253] [cursor=pointer]:
                      - generic [ref=e254]: 2W
                    - button "m4, empty" [ref=e255] [cursor=pointer]
                    - button "2L, n4, double letter, empty" [ref=e256] [cursor=pointer]:
                      - generic [ref=e257]: 2L
                    - button "o4, empty" [ref=e258] [cursor=pointer]
                    - generic [ref=e259]: "5"
                    - button "3W, a5, triple word, empty" [ref=e260] [cursor=pointer]:
                      - generic [ref=e261]: 3W
                    - button "b5, empty" [ref=e262] [cursor=pointer]
                    - button "3L, c5, triple letter, empty" [ref=e263] [cursor=pointer]:
                      - generic [ref=e264]: 3L
                    - button "d5, empty" [ref=e265] [cursor=pointer]
                    - button "e5, empty" [ref=e266] [cursor=pointer]
                    - button "f5, empty" [ref=e267] [cursor=pointer]
                    - button "2L, g5, double letter, empty" [ref=e268] [cursor=pointer]:
                      - generic [ref=e269]: 2L
                    - button "h5, empty" [ref=e270] [cursor=pointer]
                    - button "2L, i5, double letter, empty" [ref=e271] [cursor=pointer]:
                      - generic [ref=e272]: 2L
                    - button "j5, empty" [ref=e273] [cursor=pointer]
                    - button "k5, empty" [ref=e274] [cursor=pointer]
                    - button "l5, empty" [ref=e275] [cursor=pointer]
                    - button "3L, m5, triple letter, empty" [ref=e276] [cursor=pointer]:
                      - generic [ref=e277]: 3L
                    - button "n5, empty" [ref=e278] [cursor=pointer]
                    - button "3W, o5, triple word, empty" [ref=e279] [cursor=pointer]:
                      - generic [ref=e280]: 3W
                    - generic [ref=e281]: "6"
                    - button "a6, empty" [ref=e282] [cursor=pointer]
                    - button "b6, empty" [ref=e283] [cursor=pointer]
                    - button "c6, empty" [ref=e284] [cursor=pointer]
                    - button "d6, empty" [ref=e285] [cursor=pointer]
                    - button "e6, empty" [ref=e286] [cursor=pointer]
                    - button "f6, empty" [ref=e287] [cursor=pointer]
                    - button "g6, empty" [ref=e288] [cursor=pointer]
                    - button "3L, h6, triple letter, empty" [ref=e289] [cursor=pointer]:
                      - generic [ref=e290]: 3L
                    - button "i6, empty" [ref=e291] [cursor=pointer]
                    - button "j6, empty" [ref=e292] [cursor=pointer]
                    - button "k6, empty" [ref=e293] [cursor=pointer]
                    - button "l6, empty" [ref=e294] [cursor=pointer]
                    - button "m6, empty" [ref=e295] [cursor=pointer]
                    - button "n6, empty" [ref=e296] [cursor=pointer]
                    - button "o6, empty" [ref=e297] [cursor=pointer]
                    - generic [ref=e298]: "7"
                    - button "a7, empty" [ref=e299] [cursor=pointer]
                    - button "2W, b7, double word, empty" [ref=e300] [cursor=pointer]:
                      - generic [ref=e301]: 2W
                    - button "c7, empty" [ref=e302] [cursor=pointer]
                    - button "d7, empty" [ref=e303] [cursor=pointer]
                    - button "2L, e7, double letter, empty" [ref=e304] [cursor=pointer]:
                      - generic [ref=e305]: 2L
                    - button "f7, empty" [ref=e306] [cursor=pointer]
                    - button "2L, g7, double letter, empty" [ref=e307] [cursor=pointer]:
                      - generic [ref=e308]: 2L
                    - button "h7, empty" [ref=e309] [cursor=pointer]
                    - button "2L, i7, double letter, empty" [ref=e310] [cursor=pointer]:
                      - generic [ref=e311]: 2L
                    - button "j7, empty" [ref=e312] [cursor=pointer]
                    - button "2L, k7, double letter, empty" [ref=e313] [cursor=pointer]:
                      - generic [ref=e314]: 2L
                    - button "l7, empty" [ref=e315] [cursor=pointer]
                    - button "m7, empty" [ref=e316] [cursor=pointer]
                    - button "2W, n7, double word, empty" [ref=e317] [cursor=pointer]:
                      - generic [ref=e318]: 2W
                    - button "o7, empty" [ref=e319] [cursor=pointer]
                    - generic [ref=e320]: "8"
                    - button "2L, a8, double letter, empty" [ref=e321] [cursor=pointer]:
                      - generic [ref=e322]: 2L
                    - button "b8, empty" [ref=e323] [cursor=pointer]
                    - button "c8, empty" [ref=e324] [cursor=pointer]
                    - button "d8, empty" [ref=e325] [cursor=pointer]
                    - button "e8, empty" [ref=e326] [cursor=pointer]
                    - button "3L, f8, triple letter, empty" [ref=e327] [cursor=pointer]:
                      - generic [ref=e328]: 3L
                    - button "g8, empty" [ref=e329] [cursor=pointer]
                    - button "★, h8, start, double word, empty" [ref=e330] [cursor=pointer]:
                      - generic [ref=e331]: ★
                    - button "i8, empty" [ref=e332] [cursor=pointer]
                    - button "3L, j8, triple letter, empty" [ref=e333] [cursor=pointer]:
                      - generic [ref=e334]: 3L
                    - button "k8, empty" [ref=e335] [cursor=pointer]
                    - button "l8, empty" [ref=e336] [cursor=pointer]
                    - button "m8, empty" [ref=e337] [cursor=pointer]
                    - button "n8, empty" [ref=e338] [cursor=pointer]
                    - button "2L, o8, double letter, empty" [ref=e339] [cursor=pointer]:
                      - generic [ref=e340]: 2L
                    - generic [ref=e341]: "9"
                    - button "a9, empty" [ref=e342] [cursor=pointer]
                    - button "2W, b9, double word, empty" [ref=e343] [cursor=pointer]:
                      - generic [ref=e344]: 2W
                    - button "c9, empty" [ref=e345] [cursor=pointer]
                    - button "d9, empty" [ref=e346] [cursor=pointer]
                    - button "2L, e9, double letter, empty" [ref=e347] [cursor=pointer]:
                      - generic [ref=e348]: 2L
                    - button "f9, empty" [ref=e349] [cursor=pointer]
                    - button "2L, g9, double letter, empty" [ref=e350] [cursor=pointer]:
                      - generic [ref=e351]: 2L
                    - button "h9, empty" [ref=e352] [cursor=pointer]
                    - button "2L, i9, double letter, empty" [ref=e353] [cursor=pointer]:
                      - generic [ref=e354]: 2L
                    - button "j9, empty" [ref=e355] [cursor=pointer]
                    - button "2L, k9, double letter, empty" [ref=e356] [cursor=pointer]:
                      - generic [ref=e357]: 2L
                    - button "l9, empty" [ref=e358] [cursor=pointer]
                    - button "m9, empty" [ref=e359] [cursor=pointer]
                    - button "2W, n9, double word, empty" [ref=e360] [cursor=pointer]:
                      - generic [ref=e361]: 2W
                    - button "o9, empty" [ref=e362] [cursor=pointer]
                    - generic [ref=e363]: "10"
                    - button "a10, empty" [ref=e364] [cursor=pointer]
                    - button "b10, empty" [ref=e365] [cursor=pointer]
                    - button "c10, empty" [ref=e366] [cursor=pointer]
                    - button "d10, empty" [ref=e367] [cursor=pointer]
                    - button "e10, empty" [ref=e368] [cursor=pointer]
                    - button "f10, empty" [ref=e369] [cursor=pointer]
                    - button "g10, empty" [ref=e370] [cursor=pointer]
                    - button "3L, h10, triple letter, empty" [ref=e371] [cursor=pointer]:
                      - generic [ref=e372]: 3L
                    - button "i10, empty" [ref=e373] [cursor=pointer]
                    - button "j10, empty" [ref=e374] [cursor=pointer]
                    - button "k10, empty" [ref=e375] [cursor=pointer]
                    - button "l10, empty" [ref=e376] [cursor=pointer]
                    - button "m10, empty" [ref=e377] [cursor=pointer]
                    - button "n10, empty" [ref=e378] [cursor=pointer]
                    - button "o10, empty" [ref=e379] [cursor=pointer]
                    - generic [ref=e380]: "11"
                    - button "3W, a11, triple word, empty" [ref=e381] [cursor=pointer]:
                      - generic [ref=e382]: 3W
                    - button "b11, empty" [ref=e383] [cursor=pointer]
                    - button "3L, c11, triple letter, empty" [ref=e384] [cursor=pointer]:
                      - generic [ref=e385]: 3L
                    - button "d11, empty" [ref=e386] [cursor=pointer]
                    - button "e11, empty" [ref=e387] [cursor=pointer]
                    - button "f11, empty" [ref=e388] [cursor=pointer]
                    - button "2L, g11, double letter, empty" [ref=e389] [cursor=pointer]:
                      - generic [ref=e390]: 2L
                    - button "h11, empty" [ref=e391] [cursor=pointer]
                    - button "2L, i11, double letter, empty" [ref=e392] [cursor=pointer]:
                      - generic [ref=e393]: 2L
                    - button "j11, empty" [ref=e394] [cursor=pointer]
                    - button "k11, empty" [ref=e395] [cursor=pointer]
                    - button "l11, empty" [ref=e396] [cursor=pointer]
                    - button "3L, m11, triple letter, empty" [ref=e397] [cursor=pointer]:
                      - generic [ref=e398]: 3L
                    - button "n11, empty" [ref=e399] [cursor=pointer]
                    - button "3W, o11, triple word, empty" [ref=e400] [cursor=pointer]:
                      - generic [ref=e401]: 3W
                    - generic [ref=e402]: "12"
                    - button "a12, empty" [ref=e403] [cursor=pointer]
                    - button "2L, b12, double letter, empty" [ref=e404] [cursor=pointer]:
                      - generic [ref=e405]: 2L
                    - button "c12, empty" [ref=e406] [cursor=pointer]
                    - button "2W, d12, double word, empty" [ref=e407] [cursor=pointer]:
                      - generic [ref=e408]: 2W
                    - button "e12, empty" [ref=e409] [cursor=pointer]
                    - button "f12, empty" [ref=e410] [cursor=pointer]
                    - button "g12, empty" [ref=e411] [cursor=pointer]
                    - button "h12, empty" [ref=e412] [cursor=pointer]
                    - button "i12, empty" [ref=e413] [cursor=pointer]
                    - button "j12, empty" [ref=e414] [cursor=pointer]
                    - button "k12, empty" [ref=e415] [cursor=pointer]
                    - button "2W, l12, double word, empty" [ref=e416] [cursor=pointer]:
                      - generic [ref=e417]: 2W
                    - button "m12, empty" [ref=e418] [cursor=pointer]
                    - button "2L, n12, double letter, empty" [ref=e419] [cursor=pointer]:
                      - generic [ref=e420]: 2L
                    - button "o12, empty" [ref=e421] [cursor=pointer]
                    - generic [ref=e422]: "13"
                    - button "a13, empty" [ref=e423] [cursor=pointer]
                    - button "b13, empty" [ref=e424] [cursor=pointer]
                    - button "c13, empty" [ref=e425] [cursor=pointer]
                    - button "d13, empty" [ref=e426] [cursor=pointer]
                    - button "3L, e13, triple letter, empty" [ref=e427] [cursor=pointer]:
                      - generic [ref=e428]: 3L
                    - button "f13, empty" [ref=e429] [cursor=pointer]
                    - button "g13, empty" [ref=e430] [cursor=pointer]
                    - button "h13, empty" [ref=e431] [cursor=pointer]
                    - button "i13, empty" [ref=e432] [cursor=pointer]
                    - button "j13, empty" [ref=e433] [cursor=pointer]
                    - button "3L, k13, triple letter, empty" [ref=e434] [cursor=pointer]:
                      - generic [ref=e435]: 3L
                    - button "l13, empty" [ref=e436] [cursor=pointer]
                    - button "m13, empty" [ref=e437] [cursor=pointer]
                    - button "n13, empty" [ref=e438] [cursor=pointer]
                    - button "o13, empty" [ref=e439] [cursor=pointer]
                    - generic [ref=e440]: "14"
                    - button "a14, empty" [ref=e441] [cursor=pointer]
                    - button "b14, empty" [ref=e442] [cursor=pointer]
                    - button "c14, empty" [ref=e443] [cursor=pointer]
                    - button "2L, d14, double letter, empty" [ref=e444] [cursor=pointer]:
                      - generic [ref=e445]: 2L
                    - button "e14, empty" [ref=e446] [cursor=pointer]
                    - button "f14, empty" [ref=e447] [cursor=pointer]
                    - button "2W, g14, double word, empty" [ref=e448] [cursor=pointer]:
                      - generic [ref=e449]: 2W
                    - button "h14, empty" [ref=e450] [cursor=pointer]
                    - button "2W, i14, double word, empty" [ref=e451] [cursor=pointer]:
                      - generic [ref=e452]: 2W
                    - button "j14, empty" [ref=e453] [cursor=pointer]
                    - button "k14, empty" [ref=e454] [cursor=pointer]
                    - button "2L, l14, double letter, empty" [ref=e455] [cursor=pointer]:
                      - generic [ref=e456]: 2L
                    - button "m14, empty" [ref=e457] [cursor=pointer]
                    - button "n14, empty" [ref=e458] [cursor=pointer]
                    - button "o14, empty" [ref=e459] [cursor=pointer]
                    - generic [ref=e460]: "15"
                    - button "2L, a15, double letter, empty" [ref=e461] [cursor=pointer]:
                      - generic [ref=e462]: 2L
                    - button "b15, empty" [ref=e463] [cursor=pointer]
                    - button "c15, empty" [ref=e464] [cursor=pointer]
                    - button "d15, empty" [ref=e465] [cursor=pointer]
                    - button "3W, e15, triple word, empty" [ref=e466] [cursor=pointer]:
                      - generic [ref=e467]: 3W
                    - button "f15, empty" [ref=e468] [cursor=pointer]
                    - button "g15, empty" [ref=e469] [cursor=pointer]
                    - button "2L, h15, double letter, empty" [ref=e470] [cursor=pointer]:
                      - generic [ref=e471]: 2L
                    - button "i15, empty" [ref=e472] [cursor=pointer]
                    - button "j15, empty" [ref=e473] [cursor=pointer]
                    - button "3W, k15, triple word, empty" [ref=e474] [cursor=pointer]:
                      - generic [ref=e475]: 3W
                    - button "l15, empty" [ref=e476] [cursor=pointer]
                    - button "m15, empty" [ref=e477] [cursor=pointer]
                    - button "n15, empty" [ref=e478] [cursor=pointer]
                    - button "2L, o15, double letter, empty" [ref=e479] [cursor=pointer]:
                      - generic [ref=e480]: 2L
                - generic [ref=e481]:
                  - generic [ref=e483]:
                    - img "Whole board overview; outline shows the enlarged area" [ref=e484]
                    - group "View a board region" [ref=e711]:
                      - button "View a1 to e5" [ref=e712] [cursor=pointer]:
                        - generic [ref=e713]: ↖
                      - button "View f1 to j5" [ref=e714] [cursor=pointer]:
                        - generic [ref=e715]: ↑
                      - button "View k1 to o5" [ref=e716] [cursor=pointer]:
                        - generic [ref=e717]: ↗
                      - button "View a6 to e10" [ref=e718] [cursor=pointer]:
                        - generic [ref=e719]: ←
                      - button "View f6 to j10" [ref=e720] [cursor=pointer]:
                        - generic [ref=e721]: •
                      - button "View k6 to o10" [ref=e722] [cursor=pointer]:
                        - generic [ref=e723]: →
                      - button "View a11 to e15" [ref=e724] [cursor=pointer]:
                        - generic [ref=e725]: ↙
                      - button "View f11 to j15" [ref=e726] [cursor=pointer]:
                        - generic [ref=e727]: ↓
                      - button "View k11 to o15" [ref=e728] [cursor=pointer]:
                        - generic [ref=e729]: ↘
                  - generic [ref=e730]:
                    - generic [ref=e731]:
                      - generic [ref=e732]:
                        - button "Fit board" [ref=e733] [cursor=pointer]:
                          - paragraph [ref=e736]: Fit
                        - button "Enlarge board" [pressed] [ref=e737] [cursor=pointer]:
                          - paragraph [ref=e740]: Enlarge
                      - 'button "Board map: locate a square" [active] [ref=e741] [cursor=pointer]': Find a square
                    - paragraph [ref=e742]: View an area
                    - paragraph [ref=e743]: ★, h8, start, double word, empty
                    - paragraph [ref=e744]: Outline shows viewing area.
            - status [ref=e746]:
              - generic [ref=e747]:
                - generic [ref=e748]: "Amber: avery. Teal: jordan_plays."
                - text: Amber — to play · 86 tiles in the bag
            - generic [ref=e751]:
              - generic [ref=e755]:
                - generic [ref=e756]:
                  - img "Amber" [ref=e757]
                  - generic "avery" [ref=e760]
                  - generic [ref=e761]: Your move
                - generic [ref=e764]: 7 tiles
              - generic [ref=e765]:
                - generic [ref=e766]: Score
                - generic [ref=e767]: "0"
          - region "Game record" [ref=e770]:
            - generic [ref=e771]:
              - heading "Game record" [level=2] [ref=e773]
              - paragraph [ref=e774]: Amber — to play · 86 tiles in the bag
            - paragraph [ref=e777]: Live
            - generic [ref=e779]:
              - group "Game actions" [ref=e780]:
                - button "Offer draw" [ref=e781] [cursor=pointer]:
                  - paragraph [ref=e784]: Offer draw
                - button "Resign game" [ref=e785] [cursor=pointer]:
                  - paragraph [ref=e788]:
                    - text: Resign
                    - generic [ref=e789]: game
              - button "History and stats" [ref=e790] [cursor=pointer]:
                - paragraph [ref=e793]: History and stats
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
     |                                                 ^ Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/enlarged-coordinates-dark-1440.png.
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```