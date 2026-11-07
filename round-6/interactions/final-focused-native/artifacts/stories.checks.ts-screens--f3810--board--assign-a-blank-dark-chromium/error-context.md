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
  59276 pixels (ratio 0.19 of all image pixels) are different.

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
  - 59276 pixels (ratio 0.19 of all image pixels) are different.
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
  - 59276 pixels (ratio 0.19 of all image pixels) are different.

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
              - button "Blank, 0 points, on the board" [disabled] [ref=e69]
              - button "E, 1 points" [ref=e70] [cursor=pointer]:
                - generic [ref=e71]: E
                - generic [ref=e72]: "1"
              - button "S, 1 points" [ref=e73] [cursor=pointer]:
                - generic [ref=e74]: S
                - generic [ref=e75]: "1"
              - button "Q, 10 points" [ref=e76] [cursor=pointer]:
                - generic [ref=e77]: Q
                - generic [ref=e78]: "10"
            - generic [ref=e79]:
              - group "Word actions" [ref=e81]:
                - button "Play word" [disabled] [ref=e82]:
                  - paragraph [ref=e85]: Play word
                - button "Pass, exchange & tools" [ref=e86] [cursor=pointer]:
                  - paragraph [ref=e89]: Pass, exchange & tools
              - status [ref=e92]: Words have at least two letters.
            - generic [ref=e93]:
              - generic [ref=e94]:
                - button "Fit board" [pressed] [ref=e95] [cursor=pointer]:
                  - paragraph [ref=e98]: Fit board
                - button "Enlarge board" [ref=e99] [cursor=pointer]:
                  - paragraph [ref=e102]: Enlarge board
              - region "Scrollable word board" [ref=e104]:
                - group "Word board, fifteen columns and fifteen rows" [ref=e105]:
                  - generic [ref=e107]: a
                  - generic [ref=e108]: b
                  - generic [ref=e109]: c
                  - generic [ref=e110]: d
                  - generic [ref=e111]: e
                  - generic [ref=e112]: f
                  - generic [ref=e113]: g
                  - generic [ref=e114]: h
                  - generic [ref=e115]: i
                  - generic [ref=e116]: j
                  - generic [ref=e117]: k
                  - generic [ref=e118]: l
                  - generic [ref=e119]: m
                  - generic [ref=e120]: "n"
                  - generic [ref=e121]: o
                  - generic [ref=e122]: "1"
                  - button "2L, a1, double letter, empty" [ref=e123] [cursor=pointer]:
                    - generic [ref=e124]: 2L
                  - button "b1, empty" [ref=e125] [cursor=pointer]
                  - button "c1, empty" [ref=e126] [cursor=pointer]
                  - button "d1, empty" [ref=e127] [cursor=pointer]
                  - button "3W, e1, triple word, empty" [ref=e128] [cursor=pointer]:
                    - generic [ref=e129]: 3W
                  - button "f1, empty" [ref=e130] [cursor=pointer]
                  - button "g1, empty" [ref=e131] [cursor=pointer]
                  - button "2L, h1, double letter, empty" [ref=e132] [cursor=pointer]:
                    - generic [ref=e133]: 2L
                  - button "i1, empty" [ref=e134] [cursor=pointer]
                  - button "j1, empty" [ref=e135] [cursor=pointer]
                  - button "3W, k1, triple word, empty" [ref=e136] [cursor=pointer]:
                    - generic [ref=e137]: 3W
                  - button "l1, empty" [ref=e138] [cursor=pointer]
                  - button "m1, empty" [ref=e139] [cursor=pointer]
                  - button "n1, empty" [ref=e140] [cursor=pointer]
                  - button "2L, o1, double letter, empty" [ref=e141] [cursor=pointer]:
                    - generic [ref=e142]: 2L
                  - generic [ref=e143]: "2"
                  - button "a2, empty" [ref=e144] [cursor=pointer]
                  - button "b2, empty" [ref=e145] [cursor=pointer]
                  - button "c2, empty" [ref=e146] [cursor=pointer]
                  - button "2L, d2, double letter, empty" [ref=e147] [cursor=pointer]:
                    - generic [ref=e148]: 2L
                  - button "e2, empty" [ref=e149] [cursor=pointer]
                  - button "f2, empty" [ref=e150] [cursor=pointer]
                  - button "2W, g2, double word, empty" [ref=e151] [cursor=pointer]:
                    - generic [ref=e152]: 2W
                  - button "h2, empty" [ref=e153] [cursor=pointer]
                  - button "2W, i2, double word, empty" [ref=e154] [cursor=pointer]:
                    - generic [ref=e155]: 2W
                  - button "j2, empty" [ref=e156] [cursor=pointer]
                  - button "k2, empty" [ref=e157] [cursor=pointer]
                  - button "2L, l2, double letter, empty" [ref=e158] [cursor=pointer]:
                    - generic [ref=e159]: 2L
                  - button "m2, empty" [ref=e160] [cursor=pointer]
                  - button "n2, empty" [ref=e161] [cursor=pointer]
                  - button "o2, empty" [ref=e162] [cursor=pointer]
                  - generic [ref=e163]: "3"
                  - button "a3, empty" [ref=e164] [cursor=pointer]
                  - button "b3, empty" [ref=e165] [cursor=pointer]
                  - button "c3, empty" [ref=e166] [cursor=pointer]
                  - button "d3, empty" [ref=e167] [cursor=pointer]
                  - button "3L, e3, triple letter, empty" [ref=e168] [cursor=pointer]:
                    - generic [ref=e169]: 3L
                  - button "f3, empty" [ref=e170] [cursor=pointer]
                  - button "g3, empty" [ref=e171] [cursor=pointer]
                  - button "h3, empty" [ref=e172] [cursor=pointer]
                  - button "i3, empty" [ref=e173] [cursor=pointer]
                  - button "j3, empty" [ref=e174] [cursor=pointer]
                  - button "3L, k3, triple letter, empty" [ref=e175] [cursor=pointer]:
                    - generic [ref=e176]: 3L
                  - button "l3, empty" [ref=e177] [cursor=pointer]
                  - button "m3, empty" [ref=e178] [cursor=pointer]
                  - button "n3, empty" [ref=e179] [cursor=pointer]
                  - button "o3, empty" [ref=e180] [cursor=pointer]
                  - generic [ref=e181]: "4"
                  - button "a4, empty" [ref=e182] [cursor=pointer]
                  - button "2L, b4, double letter, empty" [ref=e183] [cursor=pointer]:
                    - generic [ref=e184]: 2L
                  - button "c4, empty" [ref=e185] [cursor=pointer]
                  - button "2W, d4, double word, empty" [ref=e186] [cursor=pointer]:
                    - generic [ref=e187]: 2W
                  - button "e4, empty" [ref=e188] [cursor=pointer]
                  - button "f4, empty" [ref=e189] [cursor=pointer]
                  - button "g4, empty" [ref=e190] [cursor=pointer]
                  - button "h4, empty" [ref=e191] [cursor=pointer]
                  - button "i4, empty" [ref=e192] [cursor=pointer]
                  - button "j4, empty" [ref=e193] [cursor=pointer]
                  - button "k4, empty" [ref=e194] [cursor=pointer]
                  - button "2W, l4, double word, empty" [ref=e195] [cursor=pointer]:
                    - generic [ref=e196]: 2W
                  - button "m4, empty" [ref=e197] [cursor=pointer]
                  - button "2L, n4, double letter, empty" [ref=e198] [cursor=pointer]:
                    - generic [ref=e199]: 2L
                  - button "o4, empty" [ref=e200] [cursor=pointer]
                  - generic [ref=e201]: "5"
                  - button "3W, a5, triple word, empty" [ref=e202] [cursor=pointer]:
                    - generic [ref=e203]: 3W
                  - button "b5, empty" [ref=e204] [cursor=pointer]
                  - button "3L, c5, triple letter, empty" [ref=e205] [cursor=pointer]:
                    - generic [ref=e206]: 3L
                  - button "d5, empty" [ref=e207] [cursor=pointer]
                  - button "e5, empty" [ref=e208] [cursor=pointer]
                  - button "f5, empty" [ref=e209] [cursor=pointer]
                  - button "2L, g5, double letter, empty" [ref=e210] [cursor=pointer]:
                    - generic [ref=e211]: 2L
                  - button "h5, empty" [ref=e212] [cursor=pointer]
                  - button "2L, i5, double letter, empty" [ref=e213] [cursor=pointer]:
                    - generic [ref=e214]: 2L
                  - button "j5, empty" [ref=e215] [cursor=pointer]
                  - button "k5, empty" [ref=e216] [cursor=pointer]
                  - button "l5, empty" [ref=e217] [cursor=pointer]
                  - button "3L, m5, triple letter, empty" [ref=e218] [cursor=pointer]:
                    - generic [ref=e219]: 3L
                  - button "n5, empty" [ref=e220] [cursor=pointer]
                  - button "3W, o5, triple word, empty" [ref=e221] [cursor=pointer]:
                    - generic [ref=e222]: 3W
                  - generic [ref=e223]: "6"
                  - button "a6, empty" [ref=e224] [cursor=pointer]
                  - button "b6, empty" [ref=e225] [cursor=pointer]
                  - button "c6, empty" [ref=e226] [cursor=pointer]
                  - button "d6, empty" [ref=e227] [cursor=pointer]
                  - button "e6, empty" [ref=e228] [cursor=pointer]
                  - button "f6, empty" [ref=e229] [cursor=pointer]
                  - button "g6, empty" [ref=e230] [cursor=pointer]
                  - button "3L, h6, triple letter, empty" [ref=e231] [cursor=pointer]:
                    - generic [ref=e232]: 3L
                  - button "i6, empty" [ref=e233] [cursor=pointer]
                  - button "j6, empty" [ref=e234] [cursor=pointer]
                  - button "k6, empty" [ref=e235] [cursor=pointer]
                  - button "l6, empty" [ref=e236] [cursor=pointer]
                  - button "m6, empty" [ref=e237] [cursor=pointer]
                  - button "n6, empty" [ref=e238] [cursor=pointer]
                  - button "o6, empty" [ref=e239] [cursor=pointer]
                  - generic [ref=e240]: "7"
                  - button "a7, empty" [ref=e241] [cursor=pointer]
                  - button "2W, b7, double word, empty" [ref=e242] [cursor=pointer]:
                    - generic [ref=e243]: 2W
                  - button "c7, empty" [ref=e244] [cursor=pointer]
                  - button "d7, empty" [ref=e245] [cursor=pointer]
                  - button "2L, e7, double letter, empty" [ref=e246] [cursor=pointer]:
                    - generic [ref=e247]: 2L
                  - button "f7, empty" [ref=e248] [cursor=pointer]
                  - button "2L, g7, double letter, empty" [ref=e249] [cursor=pointer]:
                    - generic [ref=e250]: 2L
                  - button "h7, empty" [ref=e251] [cursor=pointer]
                  - button "2L, i7, double letter, empty" [ref=e252] [cursor=pointer]:
                    - generic [ref=e253]: 2L
                  - button "j7, empty" [ref=e254] [cursor=pointer]
                  - button "2L, k7, double letter, empty" [ref=e255] [cursor=pointer]:
                    - generic [ref=e256]: 2L
                  - button "l7, empty" [ref=e257] [cursor=pointer]
                  - button "m7, empty" [ref=e258] [cursor=pointer]
                  - button "2W, n7, double word, empty" [ref=e259] [cursor=pointer]:
                    - generic [ref=e260]: 2W
                  - button "o7, empty" [ref=e261] [cursor=pointer]
                  - generic [ref=e262]: "8"
                  - button "2L, a8, double letter, empty" [ref=e263] [cursor=pointer]:
                    - generic [ref=e264]: 2L
                  - button "b8, empty" [ref=e265] [cursor=pointer]
                  - button "c8, empty" [ref=e266] [cursor=pointer]
                  - button "d8, empty" [ref=e267] [cursor=pointer]
                  - button "e8, empty" [ref=e268] [cursor=pointer]
                  - button "3L, f8, triple letter, empty" [ref=e269] [cursor=pointer]:
                    - generic [ref=e270]: 3L
                  - button "g8, empty" [ref=e271] [cursor=pointer]
                  - button "E 0, h8, your tentative blank as E" [active] [ref=e272] [cursor=pointer]:
                    - generic [ref=e273]: E
                  - button "i8, empty" [ref=e274] [cursor=pointer]
                  - button "3L, j8, triple letter, empty" [ref=e275] [cursor=pointer]:
                    - generic [ref=e276]: 3L
                  - button "k8, empty" [ref=e277] [cursor=pointer]
                  - button "l8, empty" [ref=e278] [cursor=pointer]
                  - button "m8, empty" [ref=e279] [cursor=pointer]
                  - button "n8, empty" [ref=e280] [cursor=pointer]
                  - button "2L, o8, double letter, empty" [ref=e281] [cursor=pointer]:
                    - generic [ref=e282]: 2L
                  - generic [ref=e283]: "9"
                  - button "a9, empty" [ref=e284] [cursor=pointer]
                  - button "2W, b9, double word, empty" [ref=e285] [cursor=pointer]:
                    - generic [ref=e286]: 2W
                  - button "c9, empty" [ref=e287] [cursor=pointer]
                  - button "d9, empty" [ref=e288] [cursor=pointer]
                  - button "2L, e9, double letter, empty" [ref=e289] [cursor=pointer]:
                    - generic [ref=e290]: 2L
                  - button "f9, empty" [ref=e291] [cursor=pointer]
                  - button "2L, g9, double letter, empty" [ref=e292] [cursor=pointer]:
                    - generic [ref=e293]: 2L
                  - button "h9, empty" [ref=e294] [cursor=pointer]
                  - button "2L, i9, double letter, empty" [ref=e295] [cursor=pointer]:
                    - generic [ref=e296]: 2L
                  - button "j9, empty" [ref=e297] [cursor=pointer]
                  - button "2L, k9, double letter, empty" [ref=e298] [cursor=pointer]:
                    - generic [ref=e299]: 2L
                  - button "l9, empty" [ref=e300] [cursor=pointer]
                  - button "m9, empty" [ref=e301] [cursor=pointer]
                  - button "2W, n9, double word, empty" [ref=e302] [cursor=pointer]:
                    - generic [ref=e303]: 2W
                  - button "o9, empty" [ref=e304] [cursor=pointer]
                  - generic [ref=e305]: "10"
                  - button "a10, empty" [ref=e306] [cursor=pointer]
                  - button "b10, empty" [ref=e307] [cursor=pointer]
                  - button "c10, empty" [ref=e308] [cursor=pointer]
                  - button "d10, empty" [ref=e309] [cursor=pointer]
                  - button "e10, empty" [ref=e310] [cursor=pointer]
                  - button "f10, empty" [ref=e311] [cursor=pointer]
                  - button "g10, empty" [ref=e312] [cursor=pointer]
                  - button "3L, h10, triple letter, empty" [ref=e313] [cursor=pointer]:
                    - generic [ref=e314]: 3L
                  - button "i10, empty" [ref=e315] [cursor=pointer]
                  - button "j10, empty" [ref=e316] [cursor=pointer]
                  - button "k10, empty" [ref=e317] [cursor=pointer]
                  - button "l10, empty" [ref=e318] [cursor=pointer]
                  - button "m10, empty" [ref=e319] [cursor=pointer]
                  - button "n10, empty" [ref=e320] [cursor=pointer]
                  - button "o10, empty" [ref=e321] [cursor=pointer]
                  - generic [ref=e322]: "11"
                  - button "3W, a11, triple word, empty" [ref=e323] [cursor=pointer]:
                    - generic [ref=e324]: 3W
                  - button "b11, empty" [ref=e325] [cursor=pointer]
                  - button "3L, c11, triple letter, empty" [ref=e326] [cursor=pointer]:
                    - generic [ref=e327]: 3L
                  - button "d11, empty" [ref=e328] [cursor=pointer]
                  - button "e11, empty" [ref=e329] [cursor=pointer]
                  - button "f11, empty" [ref=e330] [cursor=pointer]
                  - button "2L, g11, double letter, empty" [ref=e331] [cursor=pointer]:
                    - generic [ref=e332]: 2L
                  - button "h11, empty" [ref=e333] [cursor=pointer]
                  - button "2L, i11, double letter, empty" [ref=e334] [cursor=pointer]:
                    - generic [ref=e335]: 2L
                  - button "j11, empty" [ref=e336] [cursor=pointer]
                  - button "k11, empty" [ref=e337] [cursor=pointer]
                  - button "l11, empty" [ref=e338] [cursor=pointer]
                  - button "3L, m11, triple letter, empty" [ref=e339] [cursor=pointer]:
                    - generic [ref=e340]: 3L
                  - button "n11, empty" [ref=e341] [cursor=pointer]
                  - button "3W, o11, triple word, empty" [ref=e342] [cursor=pointer]:
                    - generic [ref=e343]: 3W
                  - generic [ref=e344]: "12"
                  - button "a12, empty" [ref=e345] [cursor=pointer]
                  - button "2L, b12, double letter, empty" [ref=e346] [cursor=pointer]:
                    - generic [ref=e347]: 2L
                  - button "c12, empty" [ref=e348] [cursor=pointer]
                  - button "2W, d12, double word, empty" [ref=e349] [cursor=pointer]:
                    - generic [ref=e350]: 2W
                  - button "e12, empty" [ref=e351] [cursor=pointer]
                  - button "f12, empty" [ref=e352] [cursor=pointer]
                  - button "g12, empty" [ref=e353] [cursor=pointer]
                  - button "h12, empty" [ref=e354] [cursor=pointer]
                  - button "i12, empty" [ref=e355] [cursor=pointer]
                  - button "j12, empty" [ref=e356] [cursor=pointer]
                  - button "k12, empty" [ref=e357] [cursor=pointer]
                  - button "2W, l12, double word, empty" [ref=e358] [cursor=pointer]:
                    - generic [ref=e359]: 2W
                  - button "m12, empty" [ref=e360] [cursor=pointer]
                  - button "2L, n12, double letter, empty" [ref=e361] [cursor=pointer]:
                    - generic [ref=e362]: 2L
                  - button "o12, empty" [ref=e363] [cursor=pointer]
                  - generic [ref=e364]: "13"
                  - button "a13, empty" [ref=e365] [cursor=pointer]
                  - button "b13, empty" [ref=e366] [cursor=pointer]
                  - button "c13, empty" [ref=e367] [cursor=pointer]
                  - button "d13, empty" [ref=e368] [cursor=pointer]
                  - button "3L, e13, triple letter, empty" [ref=e369] [cursor=pointer]:
                    - generic [ref=e370]: 3L
                  - button "f13, empty" [ref=e371] [cursor=pointer]
                  - button "g13, empty" [ref=e372] [cursor=pointer]
                  - button "h13, empty" [ref=e373] [cursor=pointer]
                  - button "i13, empty" [ref=e374] [cursor=pointer]
                  - button "j13, empty" [ref=e375] [cursor=pointer]
                  - button "3L, k13, triple letter, empty" [ref=e376] [cursor=pointer]:
                    - generic [ref=e377]: 3L
                  - button "l13, empty" [ref=e378] [cursor=pointer]
                  - button "m13, empty" [ref=e379] [cursor=pointer]
                  - button "n13, empty" [ref=e380] [cursor=pointer]
                  - button "o13, empty" [ref=e381] [cursor=pointer]
                  - generic [ref=e382]: "14"
                  - button "a14, empty" [ref=e383] [cursor=pointer]
                  - button "b14, empty" [ref=e384] [cursor=pointer]
                  - button "c14, empty" [ref=e385] [cursor=pointer]
                  - button "2L, d14, double letter, empty" [ref=e386] [cursor=pointer]:
                    - generic [ref=e387]: 2L
                  - button "e14, empty" [ref=e388] [cursor=pointer]
                  - button "f14, empty" [ref=e389] [cursor=pointer]
                  - button "2W, g14, double word, empty" [ref=e390] [cursor=pointer]:
                    - generic [ref=e391]: 2W
                  - button "h14, empty" [ref=e392] [cursor=pointer]
                  - button "2W, i14, double word, empty" [ref=e393] [cursor=pointer]:
                    - generic [ref=e394]: 2W
                  - button "j14, empty" [ref=e395] [cursor=pointer]
                  - button "k14, empty" [ref=e396] [cursor=pointer]
                  - button "2L, l14, double letter, empty" [ref=e397] [cursor=pointer]:
                    - generic [ref=e398]: 2L
                  - button "m14, empty" [ref=e399] [cursor=pointer]
                  - button "n14, empty" [ref=e400] [cursor=pointer]
                  - button "o14, empty" [ref=e401] [cursor=pointer]
                  - generic [ref=e402]: "15"
                  - button "2L, a15, double letter, empty" [ref=e403] [cursor=pointer]:
                    - generic [ref=e404]: 2L
                  - button "b15, empty" [ref=e405] [cursor=pointer]
                  - button "c15, empty" [ref=e406] [cursor=pointer]
                  - button "d15, empty" [ref=e407] [cursor=pointer]
                  - button "3W, e15, triple word, empty" [ref=e408] [cursor=pointer]:
                    - generic [ref=e409]: 3W
                  - button "f15, empty" [ref=e410] [cursor=pointer]
                  - button "g15, empty" [ref=e411] [cursor=pointer]
                  - button "2L, h15, double letter, empty" [ref=e412] [cursor=pointer]:
                    - generic [ref=e413]: 2L
                  - button "i15, empty" [ref=e414] [cursor=pointer]
                  - button "j15, empty" [ref=e415] [cursor=pointer]
                  - button "3W, k15, triple word, empty" [ref=e416] [cursor=pointer]:
                    - generic [ref=e417]: 3W
                  - button "l15, empty" [ref=e418] [cursor=pointer]
                  - button "m15, empty" [ref=e419] [cursor=pointer]
                  - button "n15, empty" [ref=e420] [cursor=pointer]
                  - button "2L, o15, double letter, empty" [ref=e421] [cursor=pointer]:
                    - generic [ref=e422]: 2L
          - status [ref=e424]:
            - generic [ref=e425]:
              - generic [ref=e426]: "Amber: avery. Teal: jordan_plays."
              - text: Amber — to play · 86 tiles in the bag
          - generic [ref=e429]:
            - generic [ref=e433]:
              - generic [ref=e434]:
                - img "Amber" [ref=e435]
                - generic "avery" [ref=e438]
                - generic [ref=e439]: Your move
              - generic [ref=e442]: 7 tiles
            - generic [ref=e443]:
              - generic [ref=e444]: Score
              - generic [ref=e445]: "0"
        - generic [ref=e448]:
          - group "Game actions" [ref=e449]:
            - button "Offer draw" [ref=e450] [cursor=pointer]:
              - paragraph [ref=e453]: Offer draw
            - button "Resign game" [ref=e454] [cursor=pointer]:
              - paragraph [ref=e457]:
                - text: Resign
                - generic [ref=e458]: game
          - button "History and stats" [ref=e459] [cursor=pointer]:
            - generic [ref=e461]:
              - paragraph [ref=e462]: History and stats
              - img [ref=e465]
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