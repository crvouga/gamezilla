# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--waiting-for-opponent dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  62047 pixels (ratio 0.19 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/waiting-for-opponent-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/waiting-for-opponent-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 62047 pixels (ratio 0.19 of all image pixels) are different.
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
  - 62047 pixels (ratio 0.19 of all image pixels) are different.

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
        - paragraph [ref=e24]: Teal — to play · 86 tiles in the bag
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
                - generic [ref=e51]: To move
              - generic [ref=e54]: 7 tiles
            - generic [ref=e55]:
              - generic [ref=e56]: Score
              - generic [ref=e57]: "3"
          - generic [ref=e59]:
            - group "Your rack" [ref=e60]:
              - button "O, 1 points" [ref=e61] [cursor=pointer]:
                - generic [ref=e62]: O
                - generic [ref=e63]: "1"
              - button "E, 1 points" [ref=e64] [cursor=pointer]:
                - generic [ref=e65]: E
                - generic [ref=e66]: "1"
              - button "R, 1 points" [ref=e67] [cursor=pointer]:
                - generic [ref=e68]: R
                - generic [ref=e69]: "1"
              - button "T, 1 points" [ref=e70] [cursor=pointer]:
                - generic [ref=e71]: T
                - generic [ref=e72]: "1"
              - button "I, 1 points" [ref=e73] [cursor=pointer]:
                - generic [ref=e74]: I
                - generic [ref=e75]: "1"
              - button "N, 1 points" [ref=e76] [cursor=pointer]:
                - generic [ref=e77]: "N"
                - generic [ref=e78]: "1"
              - button "Blank, 0 points" [ref=e79] [cursor=pointer]:
                - generic [ref=e80]: "0"
            - generic [ref=e81]:
              - group "Word actions" [ref=e83]:
                - button "Play word" [disabled] [ref=e84]:
                  - paragraph [ref=e87]: Play word
                - button "Pass, exchange & tools" [ref=e88] [cursor=pointer]:
                  - paragraph [ref=e91]: Pass, exchange & tools
              - generic [ref=e92]:
                - paragraph [ref=e93]: You can plan a word while you wait. Play it when your turn begins.
                - status [ref=e95]: Choose a tile, then a square.
            - generic [ref=e96]:
              - generic [ref=e97]:
                - button "Fit board" [pressed] [ref=e98] [cursor=pointer]:
                  - paragraph [ref=e101]: Fit board
                - button "Enlarge board" [ref=e102] [cursor=pointer]:
                  - paragraph [ref=e105]: Enlarge board
              - region "Scrollable word board" [ref=e107]:
                - group "Word board, fifteen columns and fifteen rows" [ref=e108]:
                  - generic [ref=e110]: a
                  - generic [ref=e111]: b
                  - generic [ref=e112]: c
                  - generic [ref=e113]: d
                  - generic [ref=e114]: e
                  - generic [ref=e115]: f
                  - generic [ref=e116]: g
                  - generic [ref=e117]: h
                  - generic [ref=e118]: i
                  - generic [ref=e119]: j
                  - generic [ref=e120]: k
                  - generic [ref=e121]: l
                  - generic [ref=e122]: m
                  - generic [ref=e123]: "n"
                  - generic [ref=e124]: o
                  - generic [ref=e125]: "1"
                  - button "2L, a1, double letter, empty" [ref=e126] [cursor=pointer]:
                    - generic [ref=e127]: 2L
                  - button "b1, empty" [ref=e128] [cursor=pointer]
                  - button "c1, empty" [ref=e129] [cursor=pointer]
                  - button "d1, empty" [ref=e130] [cursor=pointer]
                  - button "3W, e1, triple word, empty" [ref=e131] [cursor=pointer]:
                    - generic [ref=e132]: 3W
                  - button "f1, empty" [ref=e133] [cursor=pointer]
                  - button "g1, empty" [ref=e134] [cursor=pointer]
                  - button "2L, h1, double letter, empty" [ref=e135] [cursor=pointer]:
                    - generic [ref=e136]: 2L
                  - button "i1, empty" [ref=e137] [cursor=pointer]
                  - button "j1, empty" [ref=e138] [cursor=pointer]
                  - button "3W, k1, triple word, empty" [ref=e139] [cursor=pointer]:
                    - generic [ref=e140]: 3W
                  - button "l1, empty" [ref=e141] [cursor=pointer]
                  - button "m1, empty" [ref=e142] [cursor=pointer]
                  - button "n1, empty" [ref=e143] [cursor=pointer]
                  - button "2L, o1, double letter, empty" [ref=e144] [cursor=pointer]:
                    - generic [ref=e145]: 2L
                  - generic [ref=e146]: "2"
                  - button "a2, empty" [ref=e147] [cursor=pointer]
                  - button "b2, empty" [ref=e148] [cursor=pointer]
                  - button "c2, empty" [ref=e149] [cursor=pointer]
                  - button "2L, d2, double letter, empty" [ref=e150] [cursor=pointer]:
                    - generic [ref=e151]: 2L
                  - button "e2, empty" [ref=e152] [cursor=pointer]
                  - button "f2, empty" [ref=e153] [cursor=pointer]
                  - button "2W, g2, double word, empty" [ref=e154] [cursor=pointer]:
                    - generic [ref=e155]: 2W
                  - button "h2, empty" [ref=e156] [cursor=pointer]
                  - button "2W, i2, double word, empty" [ref=e157] [cursor=pointer]:
                    - generic [ref=e158]: 2W
                  - button "j2, empty" [ref=e159] [cursor=pointer]
                  - button "k2, empty" [ref=e160] [cursor=pointer]
                  - button "2L, l2, double letter, empty" [ref=e161] [cursor=pointer]:
                    - generic [ref=e162]: 2L
                  - button "m2, empty" [ref=e163] [cursor=pointer]
                  - button "n2, empty" [ref=e164] [cursor=pointer]
                  - button "o2, empty" [ref=e165] [cursor=pointer]
                  - generic [ref=e166]: "3"
                  - button "a3, empty" [ref=e167] [cursor=pointer]
                  - button "b3, empty" [ref=e168] [cursor=pointer]
                  - button "c3, empty" [ref=e169] [cursor=pointer]
                  - button "d3, empty" [ref=e170] [cursor=pointer]
                  - button "3L, e3, triple letter, empty" [ref=e171] [cursor=pointer]:
                    - generic [ref=e172]: 3L
                  - button "f3, empty" [ref=e173] [cursor=pointer]
                  - button "g3, empty" [ref=e174] [cursor=pointer]
                  - button "h3, empty" [ref=e175] [cursor=pointer]
                  - button "i3, empty" [ref=e176] [cursor=pointer]
                  - button "j3, empty" [ref=e177] [cursor=pointer]
                  - button "3L, k3, triple letter, empty" [ref=e178] [cursor=pointer]:
                    - generic [ref=e179]: 3L
                  - button "l3, empty" [ref=e180] [cursor=pointer]
                  - button "m3, empty" [ref=e181] [cursor=pointer]
                  - button "n3, empty" [ref=e182] [cursor=pointer]
                  - button "o3, empty" [ref=e183] [cursor=pointer]
                  - generic [ref=e184]: "4"
                  - button "a4, empty" [ref=e185] [cursor=pointer]
                  - button "2L, b4, double letter, empty" [ref=e186] [cursor=pointer]:
                    - generic [ref=e187]: 2L
                  - button "c4, empty" [ref=e188] [cursor=pointer]
                  - button "2W, d4, double word, empty" [ref=e189] [cursor=pointer]:
                    - generic [ref=e190]: 2W
                  - button "e4, empty" [ref=e191] [cursor=pointer]
                  - button "f4, empty" [ref=e192] [cursor=pointer]
                  - button "g4, empty" [ref=e193] [cursor=pointer]
                  - button "h4, empty" [ref=e194] [cursor=pointer]
                  - button "i4, empty" [ref=e195] [cursor=pointer]
                  - button "j4, empty" [ref=e196] [cursor=pointer]
                  - button "k4, empty" [ref=e197] [cursor=pointer]
                  - button "2W, l4, double word, empty" [ref=e198] [cursor=pointer]:
                    - generic [ref=e199]: 2W
                  - button "m4, empty" [ref=e200] [cursor=pointer]
                  - button "2L, n4, double letter, empty" [ref=e201] [cursor=pointer]:
                    - generic [ref=e202]: 2L
                  - button "o4, empty" [ref=e203] [cursor=pointer]
                  - generic [ref=e204]: "5"
                  - button "3W, a5, triple word, empty" [ref=e205] [cursor=pointer]:
                    - generic [ref=e206]: 3W
                  - button "b5, empty" [ref=e207] [cursor=pointer]
                  - button "3L, c5, triple letter, empty" [ref=e208] [cursor=pointer]:
                    - generic [ref=e209]: 3L
                  - button "d5, empty" [ref=e210] [cursor=pointer]
                  - button "e5, empty" [ref=e211] [cursor=pointer]
                  - button "f5, empty" [ref=e212] [cursor=pointer]
                  - button "2L, g5, double letter, empty" [ref=e213] [cursor=pointer]:
                    - generic [ref=e214]: 2L
                  - button "h5, empty" [ref=e215] [cursor=pointer]
                  - button "2L, i5, double letter, empty" [ref=e216] [cursor=pointer]:
                    - generic [ref=e217]: 2L
                  - button "j5, empty" [ref=e218] [cursor=pointer]
                  - button "k5, empty" [ref=e219] [cursor=pointer]
                  - button "l5, empty" [ref=e220] [cursor=pointer]
                  - button "3L, m5, triple letter, empty" [ref=e221] [cursor=pointer]:
                    - generic [ref=e222]: 3L
                  - button "n5, empty" [ref=e223] [cursor=pointer]
                  - button "3W, o5, triple word, empty" [ref=e224] [cursor=pointer]:
                    - generic [ref=e225]: 3W
                  - generic [ref=e226]: "6"
                  - button "a6, empty" [ref=e227] [cursor=pointer]
                  - button "b6, empty" [ref=e228] [cursor=pointer]
                  - button "c6, empty" [ref=e229] [cursor=pointer]
                  - button "d6, empty" [ref=e230] [cursor=pointer]
                  - button "e6, empty" [ref=e231] [cursor=pointer]
                  - button "f6, empty" [ref=e232] [cursor=pointer]
                  - button "g6, empty" [ref=e233] [cursor=pointer]
                  - button "3L, h6, triple letter, empty" [ref=e234] [cursor=pointer]:
                    - generic [ref=e235]: 3L
                  - button "i6, empty" [ref=e236] [cursor=pointer]
                  - button "j6, empty" [ref=e237] [cursor=pointer]
                  - button "k6, empty" [ref=e238] [cursor=pointer]
                  - button "l6, empty" [ref=e239] [cursor=pointer]
                  - button "m6, empty" [ref=e240] [cursor=pointer]
                  - button "n6, empty" [ref=e241] [cursor=pointer]
                  - button "o6, empty" [ref=e242] [cursor=pointer]
                  - generic [ref=e243]: "7"
                  - button "a7, empty" [ref=e244] [cursor=pointer]
                  - button "2W, b7, double word, empty" [ref=e245] [cursor=pointer]:
                    - generic [ref=e246]: 2W
                  - button "c7, empty" [ref=e247] [cursor=pointer]
                  - button "d7, empty" [ref=e248] [cursor=pointer]
                  - button "2L, e7, double letter, empty" [ref=e249] [cursor=pointer]:
                    - generic [ref=e250]: 2L
                  - button "f7, empty" [ref=e251] [cursor=pointer]
                  - button "2L, g7, double letter, empty" [ref=e252] [cursor=pointer]:
                    - generic [ref=e253]: 2L
                  - button "h7, empty" [ref=e254] [cursor=pointer]
                  - button "2L, i7, double letter, empty" [ref=e255] [cursor=pointer]:
                    - generic [ref=e256]: 2L
                  - button "j7, empty" [ref=e257] [cursor=pointer]
                  - button "2L, k7, double letter, empty" [ref=e258] [cursor=pointer]:
                    - generic [ref=e259]: 2L
                  - button "l7, empty" [ref=e260] [cursor=pointer]
                  - button "m7, empty" [ref=e261] [cursor=pointer]
                  - button "2W, n7, double word, empty" [ref=e262] [cursor=pointer]:
                    - generic [ref=e263]: 2W
                  - button "o7, empty" [ref=e264] [cursor=pointer]
                  - generic [ref=e265]: "8"
                  - button "2L, a8, double letter, empty" [ref=e266] [cursor=pointer]:
                    - generic [ref=e267]: 2L
                  - button "b8, empty" [ref=e268] [cursor=pointer]
                  - button "c8, empty" [ref=e269] [cursor=pointer]
                  - button "d8, empty" [ref=e270] [cursor=pointer]
                  - button "e8, empty" [ref=e271] [cursor=pointer]
                  - button "3L, f8, triple letter, empty" [ref=e272] [cursor=pointer]:
                    - generic [ref=e273]: 3L
                  - button "C 3, g8, committed" [disabled] [ref=e274]:
                    - generic [ref=e275]: C
                  - button "A 1, h8, committed" [disabled] [ref=e276]:
                    - generic [ref=e277]: A
                  - button "T 1, i8, committed" [disabled] [ref=e278]:
                    - generic [ref=e279]: T
                  - button "3L, j8, triple letter, empty" [ref=e280] [cursor=pointer]:
                    - generic [ref=e281]: 3L
                  - button "k8, empty" [ref=e282] [cursor=pointer]
                  - button "l8, empty" [ref=e283] [cursor=pointer]
                  - button "m8, empty" [ref=e284] [cursor=pointer]
                  - button "n8, empty" [ref=e285] [cursor=pointer]
                  - button "2L, o8, double letter, empty" [ref=e286] [cursor=pointer]:
                    - generic [ref=e287]: 2L
                  - generic [ref=e288]: "9"
                  - button "a9, empty" [ref=e289] [cursor=pointer]
                  - button "2W, b9, double word, empty" [ref=e290] [cursor=pointer]:
                    - generic [ref=e291]: 2W
                  - button "c9, empty" [ref=e292] [cursor=pointer]
                  - button "d9, empty" [ref=e293] [cursor=pointer]
                  - button "2L, e9, double letter, empty" [ref=e294] [cursor=pointer]:
                    - generic [ref=e295]: 2L
                  - button "f9, empty" [ref=e296] [cursor=pointer]
                  - button "2L, g9, double letter, empty" [ref=e297] [cursor=pointer]:
                    - generic [ref=e298]: 2L
                  - button "h9, empty" [ref=e299] [cursor=pointer]
                  - button "O 1, i9, committed" [disabled] [ref=e300]:
                    - generic [ref=e301]: O
                  - button "j9, empty" [ref=e302] [cursor=pointer]
                  - button "2L, k9, double letter, empty" [ref=e303] [cursor=pointer]:
                    - generic [ref=e304]: 2L
                  - button "l9, empty" [ref=e305] [cursor=pointer]
                  - button "m9, empty" [ref=e306] [cursor=pointer]
                  - button "2W, n9, double word, empty" [ref=e307] [cursor=pointer]:
                    - generic [ref=e308]: 2W
                  - button "o9, empty" [ref=e309] [cursor=pointer]
                  - generic [ref=e310]: "10"
                  - button "a10, empty" [ref=e311] [cursor=pointer]
                  - button "b10, empty" [ref=e312] [cursor=pointer]
                  - button "c10, empty" [ref=e313] [cursor=pointer]
                  - button "d10, empty" [ref=e314] [cursor=pointer]
                  - button "e10, empty" [ref=e315] [cursor=pointer]
                  - button "f10, empty" [ref=e316] [cursor=pointer]
                  - button "g10, empty" [ref=e317] [cursor=pointer]
                  - button "3L, h10, triple letter, empty" [ref=e318] [cursor=pointer]:
                    - generic [ref=e319]: 3L
                  - button "E 1, i10, committed" [disabled] [ref=e320]:
                    - generic [ref=e321]: E
                  - button "j10, empty" [ref=e322] [cursor=pointer]
                  - button "k10, empty" [ref=e323] [cursor=pointer]
                  - button "l10, empty" [ref=e324] [cursor=pointer]
                  - button "m10, empty" [ref=e325] [cursor=pointer]
                  - button "n10, empty" [ref=e326] [cursor=pointer]
                  - button "o10, empty" [ref=e327] [cursor=pointer]
                  - generic [ref=e328]: "11"
                  - button "3W, a11, triple word, empty" [ref=e329] [cursor=pointer]:
                    - generic [ref=e330]: 3W
                  - button "b11, empty" [ref=e331] [cursor=pointer]
                  - button "3L, c11, triple letter, empty" [ref=e332] [cursor=pointer]:
                    - generic [ref=e333]: 3L
                  - button "d11, empty" [ref=e334] [cursor=pointer]
                  - button "e11, empty" [ref=e335] [cursor=pointer]
                  - button "f11, empty" [ref=e336] [cursor=pointer]
                  - button "2L, g11, double letter, empty" [ref=e337] [cursor=pointer]:
                    - generic [ref=e338]: 2L
                  - button "h11, empty" [ref=e339] [cursor=pointer]
                  - button "2L, i11, double letter, empty" [ref=e340] [cursor=pointer]:
                    - generic [ref=e341]: 2L
                  - button "j11, empty" [ref=e342] [cursor=pointer]
                  - button "k11, empty" [ref=e343] [cursor=pointer]
                  - button "l11, empty" [ref=e344] [cursor=pointer]
                  - button "3L, m11, triple letter, empty" [ref=e345] [cursor=pointer]:
                    - generic [ref=e346]: 3L
                  - button "n11, empty" [ref=e347] [cursor=pointer]
                  - button "3W, o11, triple word, empty" [ref=e348] [cursor=pointer]:
                    - generic [ref=e349]: 3W
                  - generic [ref=e350]: "12"
                  - button "a12, empty" [ref=e351] [cursor=pointer]
                  - button "2L, b12, double letter, empty" [ref=e352] [cursor=pointer]:
                    - generic [ref=e353]: 2L
                  - button "c12, empty" [ref=e354] [cursor=pointer]
                  - button "2W, d12, double word, empty" [ref=e355] [cursor=pointer]:
                    - generic [ref=e356]: 2W
                  - button "e12, empty" [ref=e357] [cursor=pointer]
                  - button "f12, empty" [ref=e358] [cursor=pointer]
                  - button "g12, empty" [ref=e359] [cursor=pointer]
                  - button "h12, empty" [ref=e360] [cursor=pointer]
                  - button "i12, empty" [ref=e361] [cursor=pointer]
                  - button "j12, empty" [ref=e362] [cursor=pointer]
                  - button "k12, empty" [ref=e363] [cursor=pointer]
                  - button "2W, l12, double word, empty" [ref=e364] [cursor=pointer]:
                    - generic [ref=e365]: 2W
                  - button "m12, empty" [ref=e366] [cursor=pointer]
                  - button "2L, n12, double letter, empty" [ref=e367] [cursor=pointer]:
                    - generic [ref=e368]: 2L
                  - button "o12, empty" [ref=e369] [cursor=pointer]
                  - generic [ref=e370]: "13"
                  - button "a13, empty" [ref=e371] [cursor=pointer]
                  - button "b13, empty" [ref=e372] [cursor=pointer]
                  - button "c13, empty" [ref=e373] [cursor=pointer]
                  - button "d13, empty" [ref=e374] [cursor=pointer]
                  - button "3L, e13, triple letter, empty" [ref=e375] [cursor=pointer]:
                    - generic [ref=e376]: 3L
                  - button "f13, empty" [ref=e377] [cursor=pointer]
                  - button "g13, empty" [ref=e378] [cursor=pointer]
                  - button "h13, empty" [ref=e379] [cursor=pointer]
                  - button "i13, empty" [ref=e380] [cursor=pointer]
                  - button "j13, empty" [ref=e381] [cursor=pointer]
                  - button "3L, k13, triple letter, empty" [ref=e382] [cursor=pointer]:
                    - generic [ref=e383]: 3L
                  - button "l13, empty" [ref=e384] [cursor=pointer]
                  - button "m13, empty" [ref=e385] [cursor=pointer]
                  - button "n13, empty" [ref=e386] [cursor=pointer]
                  - button "o13, empty" [ref=e387] [cursor=pointer]
                  - generic [ref=e388]: "14"
                  - button "a14, empty" [ref=e389] [cursor=pointer]
                  - button "b14, empty" [ref=e390] [cursor=pointer]
                  - button "c14, empty" [ref=e391] [cursor=pointer]
                  - button "2L, d14, double letter, empty" [ref=e392] [cursor=pointer]:
                    - generic [ref=e393]: 2L
                  - button "e14, empty" [ref=e394] [cursor=pointer]
                  - button "f14, empty" [ref=e395] [cursor=pointer]
                  - button "2W, g14, double word, empty" [ref=e396] [cursor=pointer]:
                    - generic [ref=e397]: 2W
                  - button "h14, empty" [ref=e398] [cursor=pointer]
                  - button "2W, i14, double word, empty" [ref=e399] [cursor=pointer]:
                    - generic [ref=e400]: 2W
                  - button "j14, empty" [ref=e401] [cursor=pointer]
                  - button "k14, empty" [ref=e402] [cursor=pointer]
                  - button "2L, l14, double letter, empty" [ref=e403] [cursor=pointer]:
                    - generic [ref=e404]: 2L
                  - button "m14, empty" [ref=e405] [cursor=pointer]
                  - button "n14, empty" [ref=e406] [cursor=pointer]
                  - button "o14, empty" [ref=e407] [cursor=pointer]
                  - generic [ref=e408]: "15"
                  - button "2L, a15, double letter, empty" [ref=e409] [cursor=pointer]:
                    - generic [ref=e410]: 2L
                  - button "b15, empty" [ref=e411] [cursor=pointer]
                  - button "c15, empty" [ref=e412] [cursor=pointer]
                  - button "d15, empty" [ref=e413] [cursor=pointer]
                  - button "3W, e15, triple word, empty" [ref=e414] [cursor=pointer]:
                    - generic [ref=e415]: 3W
                  - button "f15, empty" [ref=e416] [cursor=pointer]
                  - button "g15, empty" [ref=e417] [cursor=pointer]
                  - button "2L, h15, double letter, empty" [ref=e418] [cursor=pointer]:
                    - generic [ref=e419]: 2L
                  - button "i15, empty" [ref=e420] [cursor=pointer]
                  - button "j15, empty" [ref=e421] [cursor=pointer]
                  - button "3W, k15, triple word, empty" [ref=e422] [cursor=pointer]:
                    - generic [ref=e423]: 3W
                  - button "l15, empty" [ref=e424] [cursor=pointer]
                  - button "m15, empty" [ref=e425] [cursor=pointer]
                  - button "n15, empty" [ref=e426] [cursor=pointer]
                  - button "2L, o15, double letter, empty" [ref=e427] [cursor=pointer]:
                    - generic [ref=e428]: 2L
          - status [ref=e430]:
            - generic [ref=e431]:
              - generic [ref=e432]: "Amber: avery. Teal: jordan_plays."
              - text: Teal — to play · 86 tiles in the bag
          - generic [ref=e435]:
            - generic [ref=e439]:
              - generic [ref=e440]:
                - img "Amber" [ref=e441]
                - generic "avery" [ref=e444]
              - generic [ref=e447]: 7 tiles
            - generic [ref=e448]:
              - generic [ref=e449]: Score
              - generic [ref=e450]: "10"
        - generic [ref=e453]:
          - group "Game actions" [ref=e454]:
            - button "Offer draw" [ref=e455] [cursor=pointer]:
              - paragraph [ref=e458]: Offer draw
            - button "Resign game" [ref=e459] [cursor=pointer]:
              - paragraph [ref=e462]:
                - text: Resign
                - generic [ref=e463]: game
          - button "History and stats" [ref=e464] [cursor=pointer]:
            - generic [ref=e466]:
              - paragraph [ref=e467]: History and stats
              - img [ref=e470]
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