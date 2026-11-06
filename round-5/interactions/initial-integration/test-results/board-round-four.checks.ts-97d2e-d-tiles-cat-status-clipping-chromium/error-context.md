# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: board-round-four.checks.ts >> screens-games-word-tiles-board--recover-and-submit regression word-tiles-cat-status-clipping
- Location: tests/storybook/board-round-four.checks.ts:57:1

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  107110 pixels (ratio 0.33 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/recover-and-submit-light.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/recover-and-submit-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 107110 pixels (ratio 0.33 of all image pixels) are different.
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
  - 107110 pixels (ratio 0.33 of all image pixels) are different.

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
        - paragraph [ref=e24]: Teal — to play · 83 tiles in the bag
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
              - generic [ref=e57]: "0"
          - generic [ref=e59]:
            - group "Your rack" [ref=e60]:
              - button "Blank, 0 points" [ref=e61] [cursor=pointer]:
                - generic [ref=e62]: "0"
              - button "E, 1 points" [ref=e63] [cursor=pointer]:
                - generic [ref=e64]: E
                - generic [ref=e65]: "1"
              - button "S, 1 points" [ref=e66] [cursor=pointer]:
                - generic [ref=e67]: S
                - generic [ref=e68]: "1"
              - button "Q, 10 points" [ref=e69] [cursor=pointer]:
                - generic [ref=e70]: Q
                - generic [ref=e71]: "10"
              - button "A, 1 points" [ref=e72] [cursor=pointer]:
                - generic [ref=e73]: A
                - generic [ref=e74]: "1"
              - button "B, 3 points" [ref=e75] [cursor=pointer]:
                - generic [ref=e76]: B
                - generic [ref=e77]: "3"
              - button "B, 3 points" [ref=e78] [cursor=pointer]:
                - generic [ref=e79]: B
                - generic [ref=e80]: "3"
            - generic [ref=e81]:
              - group "Word actions" [ref=e83]:
                - button "Play word" [disabled] [ref=e84]:
                  - paragraph [ref=e87]: Play word
                - button "More actions" [ref=e88] [cursor=pointer]:
                  - paragraph [ref=e91]: More actions
              - generic [ref=e92]:
                - paragraph [ref=e93]: You can plan a word while you wait. Play it when your turn begins.
                - status [ref=e95]: Choose a tile, then a square.
            - generic [ref=e96]:
              - generic [ref=e97]:
                - button "Fit board" [ref=e98] [cursor=pointer]:
                  - paragraph [ref=e101]: Fit board
                - button "Enlarge board" [pressed] [ref=e102] [cursor=pointer]:
                  - paragraph [ref=e105]: Enlarge board
              - paragraph [ref=e106]: Scroll to explore. Arrow keys move between squares; Enter places your selected tile.
              - generic [ref=e107]:
                - region "Scrollable word board" [ref=e108]:
                  - group "Word board, fifteen columns and fifteen rows" [ref=e109]:
                    - generic [ref=e111]: a
                    - generic [ref=e112]: b
                    - generic [ref=e113]: c
                    - generic [ref=e114]: d
                    - generic [ref=e115]: e
                    - generic [ref=e116]: f
                    - generic [ref=e117]: g
                    - generic [ref=e118]: h
                    - generic [ref=e119]: i
                    - generic [ref=e120]: j
                    - generic [ref=e121]: k
                    - generic [ref=e122]: l
                    - generic [ref=e123]: m
                    - generic [ref=e124]: "n"
                    - generic [ref=e125]: o
                    - generic [ref=e126]: "1"
                    - button "2L, a1, double letter, empty" [ref=e127] [cursor=pointer]:
                      - generic [ref=e128]: 2L
                    - button "b1, empty" [ref=e129] [cursor=pointer]
                    - button "c1, empty" [ref=e130] [cursor=pointer]
                    - button "d1, empty" [ref=e131] [cursor=pointer]
                    - button "3W, e1, triple word, empty" [ref=e132] [cursor=pointer]:
                      - generic [ref=e133]: 3W
                    - button "f1, empty" [ref=e134] [cursor=pointer]
                    - button "g1, empty" [ref=e135] [cursor=pointer]
                    - button "2L, h1, double letter, empty" [ref=e136] [cursor=pointer]:
                      - generic [ref=e137]: 2L
                    - button "i1, empty" [ref=e138] [cursor=pointer]
                    - button "j1, empty" [ref=e139] [cursor=pointer]
                    - button "3W, k1, triple word, empty" [ref=e140] [cursor=pointer]:
                      - generic [ref=e141]: 3W
                    - button "l1, empty" [ref=e142] [cursor=pointer]
                    - button "m1, empty" [ref=e143] [cursor=pointer]
                    - button "n1, empty" [ref=e144] [cursor=pointer]
                    - button "2L, o1, double letter, empty" [ref=e145] [cursor=pointer]:
                      - generic [ref=e146]: 2L
                    - generic [ref=e147]: "2"
                    - button "a2, empty" [ref=e148] [cursor=pointer]
                    - button "b2, empty" [ref=e149] [cursor=pointer]
                    - button "c2, empty" [ref=e150] [cursor=pointer]
                    - button "2L, d2, double letter, empty" [ref=e151] [cursor=pointer]:
                      - generic [ref=e152]: 2L
                    - button "e2, empty" [ref=e153] [cursor=pointer]
                    - button "f2, empty" [ref=e154] [cursor=pointer]
                    - button "2W, g2, double word, empty" [ref=e155] [cursor=pointer]:
                      - generic [ref=e156]: 2W
                    - button "h2, empty" [ref=e157] [cursor=pointer]
                    - button "2W, i2, double word, empty" [ref=e158] [cursor=pointer]:
                      - generic [ref=e159]: 2W
                    - button "j2, empty" [ref=e160] [cursor=pointer]
                    - button "k2, empty" [ref=e161] [cursor=pointer]
                    - button "2L, l2, double letter, empty" [ref=e162] [cursor=pointer]:
                      - generic [ref=e163]: 2L
                    - button "m2, empty" [ref=e164] [cursor=pointer]
                    - button "n2, empty" [ref=e165] [cursor=pointer]
                    - button "o2, empty" [ref=e166] [cursor=pointer]
                    - generic [ref=e167]: "3"
                    - button "a3, empty" [ref=e168] [cursor=pointer]
                    - button "b3, empty" [ref=e169] [cursor=pointer]
                    - button "c3, empty" [ref=e170] [cursor=pointer]
                    - button "d3, empty" [ref=e171] [cursor=pointer]
                    - button "3L, e3, triple letter, empty" [ref=e172] [cursor=pointer]:
                      - generic [ref=e173]: 3L
                    - button "f3, empty" [ref=e174] [cursor=pointer]
                    - button "g3, empty" [ref=e175] [cursor=pointer]
                    - button "h3, empty" [ref=e176] [cursor=pointer]
                    - button "i3, empty" [ref=e177] [cursor=pointer]
                    - button "j3, empty" [ref=e178] [cursor=pointer]
                    - button "3L, k3, triple letter, empty" [ref=e179] [cursor=pointer]:
                      - generic [ref=e180]: 3L
                    - button "l3, empty" [ref=e181] [cursor=pointer]
                    - button "m3, empty" [ref=e182] [cursor=pointer]
                    - button "n3, empty" [ref=e183] [cursor=pointer]
                    - button "o3, empty" [ref=e184] [cursor=pointer]
                    - generic [ref=e185]: "4"
                    - button "a4, empty" [ref=e186] [cursor=pointer]
                    - button "2L, b4, double letter, empty" [ref=e187] [cursor=pointer]:
                      - generic [ref=e188]: 2L
                    - button "c4, empty" [ref=e189] [cursor=pointer]
                    - button "2W, d4, double word, empty" [ref=e190] [cursor=pointer]:
                      - generic [ref=e191]: 2W
                    - button "e4, empty" [ref=e192] [cursor=pointer]
                    - button "f4, empty" [ref=e193] [cursor=pointer]
                    - button "g4, empty" [ref=e194] [cursor=pointer]
                    - button "h4, empty" [ref=e195] [cursor=pointer]
                    - button "i4, empty" [ref=e196] [cursor=pointer]
                    - button "j4, empty" [ref=e197] [cursor=pointer]
                    - button "k4, empty" [ref=e198] [cursor=pointer]
                    - button "2W, l4, double word, empty" [ref=e199] [cursor=pointer]:
                      - generic [ref=e200]: 2W
                    - button "m4, empty" [ref=e201] [cursor=pointer]
                    - button "2L, n4, double letter, empty" [ref=e202] [cursor=pointer]:
                      - generic [ref=e203]: 2L
                    - button "o4, empty" [ref=e204] [cursor=pointer]
                    - generic [ref=e205]: "5"
                    - button "3W, a5, triple word, empty" [ref=e206] [cursor=pointer]:
                      - generic [ref=e207]: 3W
                    - button "b5, empty" [ref=e208] [cursor=pointer]
                    - button "3L, c5, triple letter, empty" [ref=e209] [cursor=pointer]:
                      - generic [ref=e210]: 3L
                    - button "d5, empty" [ref=e211] [cursor=pointer]
                    - button "e5, empty" [ref=e212] [cursor=pointer]
                    - button "f5, empty" [ref=e213] [cursor=pointer]
                    - button "2L, g5, double letter, empty" [ref=e214] [cursor=pointer]:
                      - generic [ref=e215]: 2L
                    - button "h5, empty" [ref=e216] [cursor=pointer]
                    - button "2L, i5, double letter, empty" [ref=e217] [cursor=pointer]:
                      - generic [ref=e218]: 2L
                    - button "j5, empty" [ref=e219] [cursor=pointer]
                    - button "k5, empty" [ref=e220] [cursor=pointer]
                    - button "l5, empty" [ref=e221] [cursor=pointer]
                    - button "3L, m5, triple letter, empty" [ref=e222] [cursor=pointer]:
                      - generic [ref=e223]: 3L
                    - button "n5, empty" [ref=e224] [cursor=pointer]
                    - button "3W, o5, triple word, empty" [ref=e225] [cursor=pointer]:
                      - generic [ref=e226]: 3W
                    - generic [ref=e227]: "6"
                    - button "a6, empty" [ref=e228] [cursor=pointer]
                    - button "b6, empty" [ref=e229] [cursor=pointer]
                    - button "c6, empty" [ref=e230] [cursor=pointer]
                    - button "d6, empty" [ref=e231] [cursor=pointer]
                    - button "e6, empty" [ref=e232] [cursor=pointer]
                    - button "f6, empty" [ref=e233] [cursor=pointer]
                    - button "g6, empty" [ref=e234] [cursor=pointer]
                    - button "3L, h6, triple letter, empty" [ref=e235] [cursor=pointer]:
                      - generic [ref=e236]: 3L
                    - button "i6, empty" [ref=e237] [cursor=pointer]
                    - button "j6, empty" [ref=e238] [cursor=pointer]
                    - button "k6, empty" [ref=e239] [cursor=pointer]
                    - button "l6, empty" [ref=e240] [cursor=pointer]
                    - button "m6, empty" [ref=e241] [cursor=pointer]
                    - button "n6, empty" [ref=e242] [cursor=pointer]
                    - button "o6, empty" [ref=e243] [cursor=pointer]
                    - generic [ref=e244]: "7"
                    - button "a7, empty" [ref=e245] [cursor=pointer]
                    - button "2W, b7, double word, empty" [ref=e246] [cursor=pointer]:
                      - generic [ref=e247]: 2W
                    - button "c7, empty" [ref=e248] [cursor=pointer]
                    - button "d7, empty" [ref=e249] [cursor=pointer]
                    - button "2L, e7, double letter, empty" [ref=e250] [cursor=pointer]:
                      - generic [ref=e251]: 2L
                    - button "f7, empty" [ref=e252] [cursor=pointer]
                    - button "2L, g7, double letter, empty" [ref=e253] [cursor=pointer]:
                      - generic [ref=e254]: 2L
                    - button "h7, empty" [ref=e255] [cursor=pointer]
                    - button "2L, i7, double letter, empty" [ref=e256] [cursor=pointer]:
                      - generic [ref=e257]: 2L
                    - button "j7, empty" [ref=e258] [cursor=pointer]
                    - button "2L, k7, double letter, empty" [ref=e259] [cursor=pointer]:
                      - generic [ref=e260]: 2L
                    - button "l7, empty" [ref=e261] [cursor=pointer]
                    - button "m7, empty" [ref=e262] [cursor=pointer]
                    - button "2W, n7, double word, empty" [ref=e263] [cursor=pointer]:
                      - generic [ref=e264]: 2W
                    - button "o7, empty" [ref=e265] [cursor=pointer]
                    - generic [ref=e266]: "8"
                    - button "2L, a8, double letter, empty" [ref=e267] [cursor=pointer]:
                      - generic [ref=e268]: 2L
                    - button "b8, empty" [ref=e269] [cursor=pointer]
                    - button "c8, empty" [ref=e270] [cursor=pointer]
                    - button "d8, empty" [ref=e271] [cursor=pointer]
                    - button "e8, empty" [ref=e272] [cursor=pointer]
                    - button "3L, f8, triple letter, empty" [ref=e273] [cursor=pointer]:
                      - generic [ref=e274]: 3L
                    - button "C 3, g8, committed" [disabled] [ref=e275]:
                      - generic [ref=e276]: C
                      - generic [ref=e277]: "3"
                    - button "A 1, h8, committed" [disabled] [ref=e278]:
                      - generic [ref=e279]: A
                      - generic [ref=e280]: "1"
                    - button "T 1, i8, committed" [disabled] [ref=e281]:
                      - generic [ref=e282]: T
                      - generic [ref=e283]: "1"
                    - button "3L, j8, triple letter, empty" [ref=e284] [cursor=pointer]:
                      - generic [ref=e285]: 3L
                    - button "k8, empty" [ref=e286] [cursor=pointer]
                    - button "l8, empty" [ref=e287] [cursor=pointer]
                    - button "m8, empty" [ref=e288] [cursor=pointer]
                    - button "n8, empty" [ref=e289] [cursor=pointer]
                    - button "2L, o8, double letter, empty" [ref=e290] [cursor=pointer]:
                      - generic [ref=e291]: 2L
                    - generic [ref=e292]: "9"
                    - button "a9, empty" [ref=e293] [cursor=pointer]
                    - button "2W, b9, double word, empty" [ref=e294] [cursor=pointer]:
                      - generic [ref=e295]: 2W
                    - button "c9, empty" [ref=e296] [cursor=pointer]
                    - button "d9, empty" [ref=e297] [cursor=pointer]
                    - button "2L, e9, double letter, empty" [ref=e298] [cursor=pointer]:
                      - generic [ref=e299]: 2L
                    - button "f9, empty" [ref=e300] [cursor=pointer]
                    - button "2L, g9, double letter, empty" [ref=e301] [cursor=pointer]:
                      - generic [ref=e302]: 2L
                    - button "h9, empty" [ref=e303] [cursor=pointer]
                    - button "2L, i9, double letter, empty" [ref=e304] [cursor=pointer]:
                      - generic [ref=e305]: 2L
                    - button "j9, empty" [ref=e306] [cursor=pointer]
                    - button "2L, k9, double letter, empty" [ref=e307] [cursor=pointer]:
                      - generic [ref=e308]: 2L
                    - button "l9, empty" [ref=e309] [cursor=pointer]
                    - button "m9, empty" [ref=e310] [cursor=pointer]
                    - button "2W, n9, double word, empty" [ref=e311] [cursor=pointer]:
                      - generic [ref=e312]: 2W
                    - button "o9, empty" [ref=e313] [cursor=pointer]
                    - generic [ref=e314]: "10"
                    - button "a10, empty" [ref=e315] [cursor=pointer]
                    - button "b10, empty" [ref=e316] [cursor=pointer]
                    - button "c10, empty" [ref=e317] [cursor=pointer]
                    - button "d10, empty" [ref=e318] [cursor=pointer]
                    - button "e10, empty" [ref=e319] [cursor=pointer]
                    - button "f10, empty" [ref=e320] [cursor=pointer]
                    - button "g10, empty" [ref=e321] [cursor=pointer]
                    - button "3L, h10, triple letter, empty" [ref=e322] [cursor=pointer]:
                      - generic [ref=e323]: 3L
                    - button "i10, empty" [ref=e324] [cursor=pointer]
                    - button "j10, empty" [ref=e325] [cursor=pointer]
                    - button "k10, empty" [ref=e326] [cursor=pointer]
                    - button "l10, empty" [ref=e327] [cursor=pointer]
                    - button "m10, empty" [ref=e328] [cursor=pointer]
                    - button "n10, empty" [ref=e329] [cursor=pointer]
                    - button "o10, empty" [ref=e330] [cursor=pointer]
                    - generic [ref=e331]: "11"
                    - button "3W, a11, triple word, empty" [ref=e332] [cursor=pointer]:
                      - generic [ref=e333]: 3W
                    - button "b11, empty" [ref=e334] [cursor=pointer]
                    - button "3L, c11, triple letter, empty" [ref=e335] [cursor=pointer]:
                      - generic [ref=e336]: 3L
                    - button "d11, empty" [ref=e337] [cursor=pointer]
                    - button "e11, empty" [ref=e338] [cursor=pointer]
                    - button "f11, empty" [ref=e339] [cursor=pointer]
                    - button "2L, g11, double letter, empty" [ref=e340] [cursor=pointer]:
                      - generic [ref=e341]: 2L
                    - button "h11, empty" [ref=e342] [cursor=pointer]
                    - button "2L, i11, double letter, empty" [ref=e343] [cursor=pointer]:
                      - generic [ref=e344]: 2L
                    - button "j11, empty" [ref=e345] [cursor=pointer]
                    - button "k11, empty" [ref=e346] [cursor=pointer]
                    - button "l11, empty" [ref=e347] [cursor=pointer]
                    - button "3L, m11, triple letter, empty" [ref=e348] [cursor=pointer]:
                      - generic [ref=e349]: 3L
                    - button "n11, empty" [ref=e350] [cursor=pointer]
                    - button "3W, o11, triple word, empty" [ref=e351] [cursor=pointer]:
                      - generic [ref=e352]: 3W
                    - generic [ref=e353]: "12"
                    - button "a12, empty" [ref=e354] [cursor=pointer]
                    - button "2L, b12, double letter, empty" [ref=e355] [cursor=pointer]:
                      - generic [ref=e356]: 2L
                    - button "c12, empty" [ref=e357] [cursor=pointer]
                    - button "2W, d12, double word, empty" [ref=e358] [cursor=pointer]:
                      - generic [ref=e359]: 2W
                    - button "e12, empty" [ref=e360] [cursor=pointer]
                    - button "f12, empty" [ref=e361] [cursor=pointer]
                    - button "g12, empty" [ref=e362] [cursor=pointer]
                    - button "h12, empty" [ref=e363] [cursor=pointer]
                    - button "i12, empty" [ref=e364] [cursor=pointer]
                    - button "j12, empty" [ref=e365] [cursor=pointer]
                    - button "k12, empty" [ref=e366] [cursor=pointer]
                    - button "2W, l12, double word, empty" [ref=e367] [cursor=pointer]:
                      - generic [ref=e368]: 2W
                    - button "m12, empty" [ref=e369] [cursor=pointer]
                    - button "2L, n12, double letter, empty" [ref=e370] [cursor=pointer]:
                      - generic [ref=e371]: 2L
                    - button "o12, empty" [ref=e372] [cursor=pointer]
                    - generic [ref=e373]: "13"
                    - button "a13, empty" [ref=e374] [cursor=pointer]
                    - button "b13, empty" [ref=e375] [cursor=pointer]
                    - button "c13, empty" [ref=e376] [cursor=pointer]
                    - button "d13, empty" [ref=e377] [cursor=pointer]
                    - button "3L, e13, triple letter, empty" [ref=e378] [cursor=pointer]:
                      - generic [ref=e379]: 3L
                    - button "f13, empty" [ref=e380] [cursor=pointer]
                    - button "g13, empty" [ref=e381] [cursor=pointer]
                    - button "h13, empty" [ref=e382] [cursor=pointer]
                    - button "i13, empty" [ref=e383] [cursor=pointer]
                    - button "j13, empty" [ref=e384] [cursor=pointer]
                    - button "3L, k13, triple letter, empty" [ref=e385] [cursor=pointer]:
                      - generic [ref=e386]: 3L
                    - button "l13, empty" [ref=e387] [cursor=pointer]
                    - button "m13, empty" [ref=e388] [cursor=pointer]
                    - button "n13, empty" [ref=e389] [cursor=pointer]
                    - button "o13, empty" [ref=e390] [cursor=pointer]
                    - generic [ref=e391]: "14"
                    - button "a14, empty" [ref=e392] [cursor=pointer]
                    - button "b14, empty" [ref=e393] [cursor=pointer]
                    - button "c14, empty" [ref=e394] [cursor=pointer]
                    - button "2L, d14, double letter, empty" [ref=e395] [cursor=pointer]:
                      - generic [ref=e396]: 2L
                    - button "e14, empty" [ref=e397] [cursor=pointer]
                    - button "f14, empty" [ref=e398] [cursor=pointer]
                    - button "2W, g14, double word, empty" [ref=e399] [cursor=pointer]:
                      - generic [ref=e400]: 2W
                    - button "h14, empty" [ref=e401] [cursor=pointer]
                    - button "2W, i14, double word, empty" [ref=e402] [cursor=pointer]:
                      - generic [ref=e403]: 2W
                    - button "j14, empty" [ref=e404] [cursor=pointer]
                    - button "k14, empty" [ref=e405] [cursor=pointer]
                    - button "2L, l14, double letter, empty" [ref=e406] [cursor=pointer]:
                      - generic [ref=e407]: 2L
                    - button "m14, empty" [ref=e408] [cursor=pointer]
                    - button "n14, empty" [ref=e409] [cursor=pointer]
                    - button "o14, empty" [ref=e410] [cursor=pointer]
                    - generic [ref=e411]: "15"
                    - button "2L, a15, double letter, empty" [ref=e412] [cursor=pointer]:
                      - generic [ref=e413]: 2L
                    - button "b15, empty" [ref=e414] [cursor=pointer]
                    - button "c15, empty" [ref=e415] [cursor=pointer]
                    - button "d15, empty" [ref=e416] [cursor=pointer]
                    - button "3W, e15, triple word, empty" [ref=e417] [cursor=pointer]:
                      - generic [ref=e418]: 3W
                    - button "f15, empty" [ref=e419] [cursor=pointer]
                    - button "g15, empty" [ref=e420] [cursor=pointer]
                    - button "2L, h15, double letter, empty" [ref=e421] [cursor=pointer]:
                      - generic [ref=e422]: 2L
                    - button "i15, empty" [ref=e423] [cursor=pointer]
                    - button "j15, empty" [ref=e424] [cursor=pointer]
                    - button "3W, k15, triple word, empty" [ref=e425] [cursor=pointer]:
                      - generic [ref=e426]: 3W
                    - button "l15, empty" [ref=e427] [cursor=pointer]
                    - button "m15, empty" [ref=e428] [cursor=pointer]
                    - button "n15, empty" [ref=e429] [cursor=pointer]
                    - button "2L, o15, double letter, empty" [ref=e430] [cursor=pointer]:
                      - generic [ref=e431]: 2L
                - img "Whole board overview; outline shows the enlarged area" [ref=e432]
          - status [ref=e660]:
            - generic [ref=e661]:
              - generic [ref=e662]: "Amber: avery. Teal: jordan_plays."
              - text: Teal — to play · 83 tiles in the bag
          - generic [ref=e665]:
            - generic [ref=e669]:
              - generic [ref=e670]:
                - img "Amber" [ref=e671]
                - generic "avery" [ref=e674]
              - generic [ref=e677]: 7 tiles
            - generic [ref=e678]:
              - generic [ref=e679]: Score
              - generic [ref=e680]: "10"
        - generic [ref=e683]:
          - group "Game actions" [ref=e684]:
            - button "Offer draw" [ref=e685] [cursor=pointer]:
              - paragraph [ref=e688]: Offer draw
            - button "Resign game" [ref=e689] [cursor=pointer]:
              - paragraph [ref=e692]:
                - text: Resign
                - generic [ref=e693]: game
          - button "History and stats" [ref=e694] [cursor=pointer]:
            - generic [ref=e696]:
              - paragraph [ref=e697]: History and stats
              - img [ref=e700]
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