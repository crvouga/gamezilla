# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--assign-a-blank dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  55407 pixels (ratio 0.17 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/assign-a-blank-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/assign-a-blank-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 55407 pixels (ratio 0.17 of all image pixels) are different.
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
  - 55407 pixels (ratio 0.17 of all image pixels) are different.

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
                - generic [ref=e48]: jordan_plays
              - generic [ref=e51]: 7 tiles
            - generic [ref=e52]:
              - generic [ref=e53]: Score
              - generic [ref=e54]: "0"
          - generic [ref=e56]:
            - group "Your rack" [ref=e57]:
              - button "C, 3 points" [ref=e58] [cursor=pointer]:
                - generic [ref=e59]: C
                - generic [ref=e60]: "3"
              - button "A, 1 points" [ref=e61] [cursor=pointer]:
                - generic [ref=e62]: A
                - generic [ref=e63]: "1"
              - button "T, 1 points" [ref=e64] [cursor=pointer]:
                - generic [ref=e65]: T
                - generic [ref=e66]: "1"
              - button "Blank, 0 points, on the board" [disabled] [ref=e67]
              - button "E, 1 points" [ref=e68] [cursor=pointer]:
                - generic [ref=e69]: E
                - generic [ref=e70]: "1"
              - button "S, 1 points" [ref=e71] [cursor=pointer]:
                - generic [ref=e72]: S
                - generic [ref=e73]: "1"
              - button "Q, 10 points" [ref=e74] [cursor=pointer]:
                - generic [ref=e75]: Q
                - generic [ref=e76]: "10"
            - generic [ref=e77]:
              - group "Word actions" [ref=e78]:
                - button "Play word" [disabled] [ref=e79]:
                  - paragraph [ref=e82]: Play word
                - button "Recall tiles" [ref=e83] [cursor=pointer]:
                  - paragraph [ref=e86]: Recall tiles
                - button "Undo" [ref=e87] [cursor=pointer]:
                  - paragraph [ref=e90]: Undo
                - button "Redo" [disabled] [ref=e91]:
                  - paragraph [ref=e94]: Redo
                - button "Shuffle rack" [ref=e95] [cursor=pointer]:
                  - paragraph [ref=e98]: Shuffle rack
                - button "Pass" [ref=e99] [cursor=pointer]:
                  - paragraph [ref=e102]: Pass
                - button "Exchange tiles" [ref=e103] [cursor=pointer]:
                  - paragraph [ref=e106]: Exchange tiles
              - status [ref=e109]: Words have at least two letters.
            - generic [ref=e110]:
              - generic [ref=e111]:
                - button "Fit board" [pressed] [ref=e112] [cursor=pointer]:
                  - paragraph [ref=e115]: Fit board
                - button "Enlarge board" [ref=e116] [cursor=pointer]:
                  - paragraph [ref=e119]: Enlarge board
              - region "Scrollable word board" [ref=e121]:
                - group "Word board, fifteen columns and fifteen rows" [ref=e122]:
                  - generic [ref=e124]: a
                  - generic [ref=e125]: b
                  - generic [ref=e126]: c
                  - generic [ref=e127]: d
                  - generic [ref=e128]: e
                  - generic [ref=e129]: f
                  - generic [ref=e130]: g
                  - generic [ref=e131]: h
                  - generic [ref=e132]: i
                  - generic [ref=e133]: j
                  - generic [ref=e134]: k
                  - generic [ref=e135]: l
                  - generic [ref=e136]: m
                  - generic [ref=e137]: "n"
                  - generic [ref=e138]: o
                  - generic [ref=e139]: "1"
                  - button "2L, a1, double letter, empty" [ref=e140] [cursor=pointer]:
                    - generic [ref=e141]: 2L
                  - button "b1, empty" [ref=e142] [cursor=pointer]
                  - button "c1, empty" [ref=e143] [cursor=pointer]
                  - button "d1, empty" [ref=e144] [cursor=pointer]
                  - button "3W, e1, triple word, empty" [ref=e145] [cursor=pointer]:
                    - generic [ref=e146]: 3W
                  - button "f1, empty" [ref=e147] [cursor=pointer]
                  - button "g1, empty" [ref=e148] [cursor=pointer]
                  - button "2L, h1, double letter, empty" [ref=e149] [cursor=pointer]:
                    - generic [ref=e150]: 2L
                  - button "i1, empty" [ref=e151] [cursor=pointer]
                  - button "j1, empty" [ref=e152] [cursor=pointer]
                  - button "3W, k1, triple word, empty" [ref=e153] [cursor=pointer]:
                    - generic [ref=e154]: 3W
                  - button "l1, empty" [ref=e155] [cursor=pointer]
                  - button "m1, empty" [ref=e156] [cursor=pointer]
                  - button "n1, empty" [ref=e157] [cursor=pointer]
                  - button "2L, o1, double letter, empty" [ref=e158] [cursor=pointer]:
                    - generic [ref=e159]: 2L
                  - generic [ref=e160]: "2"
                  - button "a2, empty" [ref=e161] [cursor=pointer]
                  - button "b2, empty" [ref=e162] [cursor=pointer]
                  - button "c2, empty" [ref=e163] [cursor=pointer]
                  - button "2L, d2, double letter, empty" [ref=e164] [cursor=pointer]:
                    - generic [ref=e165]: 2L
                  - button "e2, empty" [ref=e166] [cursor=pointer]
                  - button "f2, empty" [ref=e167] [cursor=pointer]
                  - button "2W, g2, double word, empty" [ref=e168] [cursor=pointer]:
                    - generic [ref=e169]: 2W
                  - button "h2, empty" [ref=e170] [cursor=pointer]
                  - button "2W, i2, double word, empty" [ref=e171] [cursor=pointer]:
                    - generic [ref=e172]: 2W
                  - button "j2, empty" [ref=e173] [cursor=pointer]
                  - button "k2, empty" [ref=e174] [cursor=pointer]
                  - button "2L, l2, double letter, empty" [ref=e175] [cursor=pointer]:
                    - generic [ref=e176]: 2L
                  - button "m2, empty" [ref=e177] [cursor=pointer]
                  - button "n2, empty" [ref=e178] [cursor=pointer]
                  - button "o2, empty" [ref=e179] [cursor=pointer]
                  - generic [ref=e180]: "3"
                  - button "a3, empty" [ref=e181] [cursor=pointer]
                  - button "b3, empty" [ref=e182] [cursor=pointer]
                  - button "c3, empty" [ref=e183] [cursor=pointer]
                  - button "d3, empty" [ref=e184] [cursor=pointer]
                  - button "3L, e3, triple letter, empty" [ref=e185] [cursor=pointer]:
                    - generic [ref=e186]: 3L
                  - button "f3, empty" [ref=e187] [cursor=pointer]
                  - button "g3, empty" [ref=e188] [cursor=pointer]
                  - button "h3, empty" [ref=e189] [cursor=pointer]
                  - button "i3, empty" [ref=e190] [cursor=pointer]
                  - button "j3, empty" [ref=e191] [cursor=pointer]
                  - button "3L, k3, triple letter, empty" [ref=e192] [cursor=pointer]:
                    - generic [ref=e193]: 3L
                  - button "l3, empty" [ref=e194] [cursor=pointer]
                  - button "m3, empty" [ref=e195] [cursor=pointer]
                  - button "n3, empty" [ref=e196] [cursor=pointer]
                  - button "o3, empty" [ref=e197] [cursor=pointer]
                  - generic [ref=e198]: "4"
                  - button "a4, empty" [ref=e199] [cursor=pointer]
                  - button "2L, b4, double letter, empty" [ref=e200] [cursor=pointer]:
                    - generic [ref=e201]: 2L
                  - button "c4, empty" [ref=e202] [cursor=pointer]
                  - button "2W, d4, double word, empty" [ref=e203] [cursor=pointer]:
                    - generic [ref=e204]: 2W
                  - button "e4, empty" [ref=e205] [cursor=pointer]
                  - button "f4, empty" [ref=e206] [cursor=pointer]
                  - button "g4, empty" [ref=e207] [cursor=pointer]
                  - button "h4, empty" [ref=e208] [cursor=pointer]
                  - button "i4, empty" [ref=e209] [cursor=pointer]
                  - button "j4, empty" [ref=e210] [cursor=pointer]
                  - button "k4, empty" [ref=e211] [cursor=pointer]
                  - button "2W, l4, double word, empty" [ref=e212] [cursor=pointer]:
                    - generic [ref=e213]: 2W
                  - button "m4, empty" [ref=e214] [cursor=pointer]
                  - button "2L, n4, double letter, empty" [ref=e215] [cursor=pointer]:
                    - generic [ref=e216]: 2L
                  - button "o4, empty" [ref=e217] [cursor=pointer]
                  - generic [ref=e218]: "5"
                  - button "3W, a5, triple word, empty" [ref=e219] [cursor=pointer]:
                    - generic [ref=e220]: 3W
                  - button "b5, empty" [ref=e221] [cursor=pointer]
                  - button "3L, c5, triple letter, empty" [ref=e222] [cursor=pointer]:
                    - generic [ref=e223]: 3L
                  - button "d5, empty" [ref=e224] [cursor=pointer]
                  - button "e5, empty" [ref=e225] [cursor=pointer]
                  - button "f5, empty" [ref=e226] [cursor=pointer]
                  - button "2L, g5, double letter, empty" [ref=e227] [cursor=pointer]:
                    - generic [ref=e228]: 2L
                  - button "h5, empty" [ref=e229] [cursor=pointer]
                  - button "2L, i5, double letter, empty" [ref=e230] [cursor=pointer]:
                    - generic [ref=e231]: 2L
                  - button "j5, empty" [ref=e232] [cursor=pointer]
                  - button "k5, empty" [ref=e233] [cursor=pointer]
                  - button "l5, empty" [ref=e234] [cursor=pointer]
                  - button "3L, m5, triple letter, empty" [ref=e235] [cursor=pointer]:
                    - generic [ref=e236]: 3L
                  - button "n5, empty" [ref=e237] [cursor=pointer]
                  - button "3W, o5, triple word, empty" [ref=e238] [cursor=pointer]:
                    - generic [ref=e239]: 3W
                  - generic [ref=e240]: "6"
                  - button "a6, empty" [ref=e241] [cursor=pointer]
                  - button "b6, empty" [ref=e242] [cursor=pointer]
                  - button "c6, empty" [ref=e243] [cursor=pointer]
                  - button "d6, empty" [ref=e244] [cursor=pointer]
                  - button "e6, empty" [ref=e245] [cursor=pointer]
                  - button "f6, empty" [ref=e246] [cursor=pointer]
                  - button "g6, empty" [ref=e247] [cursor=pointer]
                  - button "3L, h6, triple letter, empty" [ref=e248] [cursor=pointer]:
                    - generic [ref=e249]: 3L
                  - button "i6, empty" [ref=e250] [cursor=pointer]
                  - button "j6, empty" [ref=e251] [cursor=pointer]
                  - button "k6, empty" [ref=e252] [cursor=pointer]
                  - button "l6, empty" [ref=e253] [cursor=pointer]
                  - button "m6, empty" [ref=e254] [cursor=pointer]
                  - button "n6, empty" [ref=e255] [cursor=pointer]
                  - button "o6, empty" [ref=e256] [cursor=pointer]
                  - generic [ref=e257]: "7"
                  - button "a7, empty" [ref=e258] [cursor=pointer]
                  - button "2W, b7, double word, empty" [ref=e259] [cursor=pointer]:
                    - generic [ref=e260]: 2W
                  - button "c7, empty" [ref=e261] [cursor=pointer]
                  - button "d7, empty" [ref=e262] [cursor=pointer]
                  - button "2L, e7, double letter, empty" [ref=e263] [cursor=pointer]:
                    - generic [ref=e264]: 2L
                  - button "f7, empty" [ref=e265] [cursor=pointer]
                  - button "2L, g7, double letter, empty" [ref=e266] [cursor=pointer]:
                    - generic [ref=e267]: 2L
                  - button "h7, empty" [ref=e268] [cursor=pointer]
                  - button "2L, i7, double letter, empty" [ref=e269] [cursor=pointer]:
                    - generic [ref=e270]: 2L
                  - button "j7, empty" [ref=e271] [cursor=pointer]
                  - button "2L, k7, double letter, empty" [ref=e272] [cursor=pointer]:
                    - generic [ref=e273]: 2L
                  - button "l7, empty" [ref=e274] [cursor=pointer]
                  - button "m7, empty" [ref=e275] [cursor=pointer]
                  - button "2W, n7, double word, empty" [ref=e276] [cursor=pointer]:
                    - generic [ref=e277]: 2W
                  - button "o7, empty" [ref=e278] [cursor=pointer]
                  - generic [ref=e279]: "8"
                  - button "2L, a8, double letter, empty" [ref=e280] [cursor=pointer]:
                    - generic [ref=e281]: 2L
                  - button "b8, empty" [ref=e282] [cursor=pointer]
                  - button "c8, empty" [ref=e283] [cursor=pointer]
                  - button "d8, empty" [ref=e284] [cursor=pointer]
                  - button "e8, empty" [ref=e285] [cursor=pointer]
                  - button "3L, f8, triple letter, empty" [ref=e286] [cursor=pointer]:
                    - generic [ref=e287]: 3L
                  - button "g8, empty" [ref=e288] [cursor=pointer]
                  - button "E 0, h8, your tentative blank as E" [ref=e289] [cursor=pointer]:
                    - generic [ref=e290]: E
                  - button "i8, empty" [ref=e291] [cursor=pointer]
                  - button "3L, j8, triple letter, empty" [ref=e292] [cursor=pointer]:
                    - generic [ref=e293]: 3L
                  - button "k8, empty" [ref=e294] [cursor=pointer]
                  - button "l8, empty" [ref=e295] [cursor=pointer]
                  - button "m8, empty" [ref=e296] [cursor=pointer]
                  - button "n8, empty" [ref=e297] [cursor=pointer]
                  - button "2L, o8, double letter, empty" [ref=e298] [cursor=pointer]:
                    - generic [ref=e299]: 2L
                  - generic [ref=e300]: "9"
                  - button "a9, empty" [ref=e301] [cursor=pointer]
                  - button "2W, b9, double word, empty" [ref=e302] [cursor=pointer]:
                    - generic [ref=e303]: 2W
                  - button "c9, empty" [ref=e304] [cursor=pointer]
                  - button "d9, empty" [ref=e305] [cursor=pointer]
                  - button "2L, e9, double letter, empty" [ref=e306] [cursor=pointer]:
                    - generic [ref=e307]: 2L
                  - button "f9, empty" [ref=e308] [cursor=pointer]
                  - button "2L, g9, double letter, empty" [ref=e309] [cursor=pointer]:
                    - generic [ref=e310]: 2L
                  - button "h9, empty" [ref=e311] [cursor=pointer]
                  - button "2L, i9, double letter, empty" [ref=e312] [cursor=pointer]:
                    - generic [ref=e313]: 2L
                  - button "j9, empty" [ref=e314] [cursor=pointer]
                  - button "2L, k9, double letter, empty" [ref=e315] [cursor=pointer]:
                    - generic [ref=e316]: 2L
                  - button "l9, empty" [ref=e317] [cursor=pointer]
                  - button "m9, empty" [ref=e318] [cursor=pointer]
                  - button "2W, n9, double word, empty" [ref=e319] [cursor=pointer]:
                    - generic [ref=e320]: 2W
                  - button "o9, empty" [ref=e321] [cursor=pointer]
                  - generic [ref=e322]: "10"
                  - button "a10, empty" [ref=e323] [cursor=pointer]
                  - button "b10, empty" [ref=e324] [cursor=pointer]
                  - button "c10, empty" [ref=e325] [cursor=pointer]
                  - button "d10, empty" [ref=e326] [cursor=pointer]
                  - button "e10, empty" [ref=e327] [cursor=pointer]
                  - button "f10, empty" [ref=e328] [cursor=pointer]
                  - button "g10, empty" [ref=e329] [cursor=pointer]
                  - button "3L, h10, triple letter, empty" [ref=e330] [cursor=pointer]:
                    - generic [ref=e331]: 3L
                  - button "i10, empty" [ref=e332] [cursor=pointer]
                  - button "j10, empty" [ref=e333] [cursor=pointer]
                  - button "k10, empty" [ref=e334] [cursor=pointer]
                  - button "l10, empty" [ref=e335] [cursor=pointer]
                  - button "m10, empty" [ref=e336] [cursor=pointer]
                  - button "n10, empty" [ref=e337] [cursor=pointer]
                  - button "o10, empty" [ref=e338] [cursor=pointer]
                  - generic [ref=e339]: "11"
                  - button "3W, a11, triple word, empty" [ref=e340] [cursor=pointer]:
                    - generic [ref=e341]: 3W
                  - button "b11, empty" [ref=e342] [cursor=pointer]
                  - button "3L, c11, triple letter, empty" [ref=e343] [cursor=pointer]:
                    - generic [ref=e344]: 3L
                  - button "d11, empty" [ref=e345] [cursor=pointer]
                  - button "e11, empty" [ref=e346] [cursor=pointer]
                  - button "f11, empty" [ref=e347] [cursor=pointer]
                  - button "2L, g11, double letter, empty" [ref=e348] [cursor=pointer]:
                    - generic [ref=e349]: 2L
                  - button "h11, empty" [ref=e350] [cursor=pointer]
                  - button "2L, i11, double letter, empty" [ref=e351] [cursor=pointer]:
                    - generic [ref=e352]: 2L
                  - button "j11, empty" [ref=e353] [cursor=pointer]
                  - button "k11, empty" [ref=e354] [cursor=pointer]
                  - button "l11, empty" [ref=e355] [cursor=pointer]
                  - button "3L, m11, triple letter, empty" [ref=e356] [cursor=pointer]:
                    - generic [ref=e357]: 3L
                  - button "n11, empty" [ref=e358] [cursor=pointer]
                  - button "3W, o11, triple word, empty" [ref=e359] [cursor=pointer]:
                    - generic [ref=e360]: 3W
                  - generic [ref=e361]: "12"
                  - button "a12, empty" [ref=e362] [cursor=pointer]
                  - button "2L, b12, double letter, empty" [ref=e363] [cursor=pointer]:
                    - generic [ref=e364]: 2L
                  - button "c12, empty" [ref=e365] [cursor=pointer]
                  - button "2W, d12, double word, empty" [ref=e366] [cursor=pointer]:
                    - generic [ref=e367]: 2W
                  - button "e12, empty" [ref=e368] [cursor=pointer]
                  - button "f12, empty" [ref=e369] [cursor=pointer]
                  - button "g12, empty" [ref=e370] [cursor=pointer]
                  - button "h12, empty" [ref=e371] [cursor=pointer]
                  - button "i12, empty" [ref=e372] [cursor=pointer]
                  - button "j12, empty" [ref=e373] [cursor=pointer]
                  - button "k12, empty" [ref=e374] [cursor=pointer]
                  - button "2W, l12, double word, empty" [ref=e375] [cursor=pointer]:
                    - generic [ref=e376]: 2W
                  - button "m12, empty" [ref=e377] [cursor=pointer]
                  - button "2L, n12, double letter, empty" [ref=e378] [cursor=pointer]:
                    - generic [ref=e379]: 2L
                  - button "o12, empty" [ref=e380] [cursor=pointer]
                  - generic [ref=e381]: "13"
                  - button "a13, empty" [ref=e382] [cursor=pointer]
                  - button "b13, empty" [ref=e383] [cursor=pointer]
                  - button "c13, empty" [ref=e384] [cursor=pointer]
                  - button "d13, empty" [ref=e385] [cursor=pointer]
                  - button "3L, e13, triple letter, empty" [ref=e386] [cursor=pointer]:
                    - generic [ref=e387]: 3L
                  - button "f13, empty" [ref=e388] [cursor=pointer]
                  - button "g13, empty" [ref=e389] [cursor=pointer]
                  - button "h13, empty" [ref=e390] [cursor=pointer]
                  - button "i13, empty" [ref=e391] [cursor=pointer]
                  - button "j13, empty" [ref=e392] [cursor=pointer]
                  - button "3L, k13, triple letter, empty" [ref=e393] [cursor=pointer]:
                    - generic [ref=e394]: 3L
                  - button "l13, empty" [ref=e395] [cursor=pointer]
                  - button "m13, empty" [ref=e396] [cursor=pointer]
                  - button "n13, empty" [ref=e397] [cursor=pointer]
                  - button "o13, empty" [ref=e398] [cursor=pointer]
                  - generic [ref=e399]: "14"
                  - button "a14, empty" [ref=e400] [cursor=pointer]
                  - button "b14, empty" [ref=e401] [cursor=pointer]
                  - button "c14, empty" [ref=e402] [cursor=pointer]
                  - button "2L, d14, double letter, empty" [ref=e403] [cursor=pointer]:
                    - generic [ref=e404]: 2L
                  - button "e14, empty" [ref=e405] [cursor=pointer]
                  - button "f14, empty" [ref=e406] [cursor=pointer]
                  - button "2W, g14, double word, empty" [ref=e407] [cursor=pointer]:
                    - generic [ref=e408]: 2W
                  - button "h14, empty" [ref=e409] [cursor=pointer]
                  - button "2W, i14, double word, empty" [ref=e410] [cursor=pointer]:
                    - generic [ref=e411]: 2W
                  - button "j14, empty" [ref=e412] [cursor=pointer]
                  - button "k14, empty" [ref=e413] [cursor=pointer]
                  - button "2L, l14, double letter, empty" [ref=e414] [cursor=pointer]:
                    - generic [ref=e415]: 2L
                  - button "m14, empty" [ref=e416] [cursor=pointer]
                  - button "n14, empty" [ref=e417] [cursor=pointer]
                  - button "o14, empty" [ref=e418] [cursor=pointer]
                  - generic [ref=e419]: "15"
                  - button "2L, a15, double letter, empty" [ref=e420] [cursor=pointer]:
                    - generic [ref=e421]: 2L
                  - button "b15, empty" [ref=e422] [cursor=pointer]
                  - button "c15, empty" [ref=e423] [cursor=pointer]
                  - button "d15, empty" [ref=e424] [cursor=pointer]
                  - button "3W, e15, triple word, empty" [ref=e425] [cursor=pointer]:
                    - generic [ref=e426]: 3W
                  - button "f15, empty" [ref=e427] [cursor=pointer]
                  - button "g15, empty" [ref=e428] [cursor=pointer]
                  - button "2L, h15, double letter, empty" [ref=e429] [cursor=pointer]:
                    - generic [ref=e430]: 2L
                  - button "i15, empty" [ref=e431] [cursor=pointer]
                  - button "j15, empty" [ref=e432] [cursor=pointer]
                  - button "3W, k15, triple word, empty" [ref=e433] [cursor=pointer]:
                    - generic [ref=e434]: 3W
                  - button "l15, empty" [ref=e435] [cursor=pointer]
                  - button "m15, empty" [ref=e436] [cursor=pointer]
                  - button "n15, empty" [ref=e437] [cursor=pointer]
                  - button "2L, o15, double letter, empty" [ref=e438] [cursor=pointer]:
                    - generic [ref=e439]: 2L
          - status [ref=e441]:
            - generic [ref=e442]:
              - generic [ref=e443]: "Amber: avery. Teal: jordan_plays."
              - text: Amber — to play · 86 tiles in the bag
          - generic [ref=e446]:
            - generic [ref=e450]:
              - generic [ref=e451]:
                - img "Amber" [ref=e452]
                - generic [ref=e453]: avery
                - generic [ref=e454]: Your move
              - generic [ref=e457]: 7 tiles
            - generic [ref=e458]:
              - generic [ref=e459]: Score
              - generic [ref=e460]: "0"
        - generic [ref=e463]:
          - group "Game actions" [ref=e464]:
            - button "Offer draw" [ref=e465] [cursor=pointer]:
              - paragraph [ref=e468]: Offer draw
            - button "Resign game" [ref=e469] [cursor=pointer]:
              - paragraph [ref=e472]:
                - text: Resign
                - generic [ref=e473]: game
          - button "History and stats" [ref=e474] [cursor=pointer]:
            - generic [ref=e476]:
              - paragraph [ref=e477]: History and stats
              - img [ref=e480]
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