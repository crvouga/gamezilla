# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--recover-and-submit light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  145084 pixels (ratio 0.12 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/recover-and-submit-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/recover-and-submit-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 145084 pixels (ratio 0.12 of all image pixels) are different.
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
  - 145084 pixels (ratio 0.12 of all image pixels) are different.

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
              - generic [ref=e36]: jordan_plays
              - generic [ref=e37]: To move
            - generic [ref=e40]: 7 tiles
          - generic [ref=e41]:
            - generic [ref=e42]: Score
            - generic [ref=e43]: "0"
        - generic [ref=e45]:
          - group "Your rack" [ref=e46]:
            - button "Blank, 0 points" [ref=e47] [cursor=pointer]:
              - generic [ref=e48]: "0"
            - button "E, 1 points" [ref=e49] [cursor=pointer]:
              - generic [ref=e50]: E
              - generic [ref=e51]: "1"
            - button "S, 1 points" [ref=e52] [cursor=pointer]:
              - generic [ref=e53]: S
              - generic [ref=e54]: "1"
            - button "Q, 10 points" [ref=e55] [cursor=pointer]:
              - generic [ref=e56]: Q
              - generic [ref=e57]: "10"
            - button "A, 1 points" [ref=e58] [cursor=pointer]:
              - generic [ref=e59]: A
              - generic [ref=e60]: "1"
            - button "B, 3 points" [ref=e61] [cursor=pointer]:
              - generic [ref=e62]: B
              - generic [ref=e63]: "3"
            - button "B, 3 points" [ref=e64] [cursor=pointer]:
              - generic [ref=e65]: B
              - generic [ref=e66]: "3"
          - generic [ref=e67]:
            - group "Word actions" [ref=e68]:
              - button "Play word" [disabled] [ref=e69]:
                - paragraph [ref=e72]: Play word
              - button "Recall tiles" [disabled] [ref=e73]:
                - paragraph [ref=e76]: Recall tiles
              - button "Undo" [disabled] [ref=e77]:
                - paragraph [ref=e80]: Undo
              - button "Redo" [disabled] [ref=e81]:
                - paragraph [ref=e84]: Redo
              - button "Shuffle rack" [ref=e85] [cursor=pointer]:
                - paragraph [ref=e88]: Shuffle rack
              - button "Pass" [disabled] [ref=e89]:
                - paragraph [ref=e92]: Pass
              - button "Exchange tiles" [disabled] [ref=e93]:
                - paragraph [ref=e96]: Exchange tiles
            - generic [ref=e97]:
              - paragraph [ref=e98]: You can plan a word while you wait. Play it when your turn begins.
              - status [ref=e100]: Choose a tile, then a square.
          - generic [ref=e101]:
            - generic [ref=e102]:
              - button "Fit board" [ref=e103] [cursor=pointer]:
                - paragraph [ref=e106]: Fit board
              - button "Enlarge board" [pressed] [ref=e107] [cursor=pointer]:
                - paragraph [ref=e110]: Enlarge board
            - paragraph [ref=e111]: Scroll to explore. Arrow keys move between squares; Enter places your selected tile.
            - generic [ref=e112]:
              - region "Scrollable word board" [ref=e113]:
                - group "Word board, fifteen columns and fifteen rows" [ref=e114]:
                  - generic [ref=e116]: a
                  - generic [ref=e117]: b
                  - generic [ref=e118]: c
                  - generic [ref=e119]: d
                  - generic [ref=e120]: e
                  - generic [ref=e121]: f
                  - generic [ref=e122]: g
                  - generic [ref=e123]: h
                  - generic [ref=e124]: i
                  - generic [ref=e125]: j
                  - generic [ref=e126]: k
                  - generic [ref=e127]: l
                  - generic [ref=e128]: m
                  - generic [ref=e129]: "n"
                  - generic [ref=e130]: o
                  - generic [ref=e131]: "1"
                  - button "2L, a1, double letter, empty" [ref=e132] [cursor=pointer]:
                    - generic [ref=e133]: 2L
                  - button "b1, empty" [ref=e134] [cursor=pointer]
                  - button "c1, empty" [ref=e135] [cursor=pointer]
                  - button "d1, empty" [ref=e136] [cursor=pointer]
                  - button "3W, e1, triple word, empty" [ref=e137] [cursor=pointer]:
                    - generic [ref=e138]: 3W
                  - button "f1, empty" [ref=e139] [cursor=pointer]
                  - button "g1, empty" [ref=e140] [cursor=pointer]
                  - button "2L, h1, double letter, empty" [ref=e141] [cursor=pointer]:
                    - generic [ref=e142]: 2L
                  - button "i1, empty" [ref=e143] [cursor=pointer]
                  - button "j1, empty" [ref=e144] [cursor=pointer]
                  - button "3W, k1, triple word, empty" [ref=e145] [cursor=pointer]:
                    - generic [ref=e146]: 3W
                  - button "l1, empty" [ref=e147] [cursor=pointer]
                  - button "m1, empty" [ref=e148] [cursor=pointer]
                  - button "n1, empty" [ref=e149] [cursor=pointer]
                  - button "2L, o1, double letter, empty" [ref=e150] [cursor=pointer]:
                    - generic [ref=e151]: 2L
                  - generic [ref=e152]: "2"
                  - button "a2, empty" [ref=e153] [cursor=pointer]
                  - button "b2, empty" [ref=e154] [cursor=pointer]
                  - button "c2, empty" [ref=e155] [cursor=pointer]
                  - button "2L, d2, double letter, empty" [ref=e156] [cursor=pointer]:
                    - generic [ref=e157]: 2L
                  - button "e2, empty" [ref=e158] [cursor=pointer]
                  - button "f2, empty" [ref=e159] [cursor=pointer]
                  - button "2W, g2, double word, empty" [ref=e160] [cursor=pointer]:
                    - generic [ref=e161]: 2W
                  - button "h2, empty" [ref=e162] [cursor=pointer]
                  - button "2W, i2, double word, empty" [ref=e163] [cursor=pointer]:
                    - generic [ref=e164]: 2W
                  - button "j2, empty" [ref=e165] [cursor=pointer]
                  - button "k2, empty" [ref=e166] [cursor=pointer]
                  - button "2L, l2, double letter, empty" [ref=e167] [cursor=pointer]:
                    - generic [ref=e168]: 2L
                  - button "m2, empty" [ref=e169] [cursor=pointer]
                  - button "n2, empty" [ref=e170] [cursor=pointer]
                  - button "o2, empty" [ref=e171] [cursor=pointer]
                  - generic [ref=e172]: "3"
                  - button "a3, empty" [ref=e173] [cursor=pointer]
                  - button "b3, empty" [ref=e174] [cursor=pointer]
                  - button "c3, empty" [ref=e175] [cursor=pointer]
                  - button "d3, empty" [ref=e176] [cursor=pointer]
                  - button "3L, e3, triple letter, empty" [ref=e177] [cursor=pointer]:
                    - generic [ref=e178]: 3L
                  - button "f3, empty" [ref=e179] [cursor=pointer]
                  - button "g3, empty" [ref=e180] [cursor=pointer]
                  - button "h3, empty" [ref=e181] [cursor=pointer]
                  - button "i3, empty" [ref=e182] [cursor=pointer]
                  - button "j3, empty" [ref=e183] [cursor=pointer]
                  - button "3L, k3, triple letter, empty" [ref=e184] [cursor=pointer]:
                    - generic [ref=e185]: 3L
                  - button "l3, empty" [ref=e186] [cursor=pointer]
                  - button "m3, empty" [ref=e187] [cursor=pointer]
                  - button "n3, empty" [ref=e188] [cursor=pointer]
                  - button "o3, empty" [ref=e189] [cursor=pointer]
                  - generic [ref=e190]: "4"
                  - button "a4, empty" [ref=e191] [cursor=pointer]
                  - button "2L, b4, double letter, empty" [ref=e192] [cursor=pointer]:
                    - generic [ref=e193]: 2L
                  - button "c4, empty" [ref=e194] [cursor=pointer]
                  - button "2W, d4, double word, empty" [ref=e195] [cursor=pointer]:
                    - generic [ref=e196]: 2W
                  - button "e4, empty" [ref=e197] [cursor=pointer]
                  - button "f4, empty" [ref=e198] [cursor=pointer]
                  - button "g4, empty" [ref=e199] [cursor=pointer]
                  - button "h4, empty" [ref=e200] [cursor=pointer]
                  - button "i4, empty" [ref=e201] [cursor=pointer]
                  - button "j4, empty" [ref=e202] [cursor=pointer]
                  - button "k4, empty" [ref=e203] [cursor=pointer]
                  - button "2W, l4, double word, empty" [ref=e204] [cursor=pointer]:
                    - generic [ref=e205]: 2W
                  - button "m4, empty" [ref=e206] [cursor=pointer]
                  - button "2L, n4, double letter, empty" [ref=e207] [cursor=pointer]:
                    - generic [ref=e208]: 2L
                  - button "o4, empty" [ref=e209] [cursor=pointer]
                  - generic [ref=e210]: "5"
                  - button "3W, a5, triple word, empty" [ref=e211] [cursor=pointer]:
                    - generic [ref=e212]: 3W
                  - button "b5, empty" [ref=e213] [cursor=pointer]
                  - button "3L, c5, triple letter, empty" [ref=e214] [cursor=pointer]:
                    - generic [ref=e215]: 3L
                  - button "d5, empty" [ref=e216] [cursor=pointer]
                  - button "e5, empty" [ref=e217] [cursor=pointer]
                  - button "f5, empty" [ref=e218] [cursor=pointer]
                  - button "2L, g5, double letter, empty" [ref=e219] [cursor=pointer]:
                    - generic [ref=e220]: 2L
                  - button "h5, empty" [ref=e221] [cursor=pointer]
                  - button "2L, i5, double letter, empty" [ref=e222] [cursor=pointer]:
                    - generic [ref=e223]: 2L
                  - button "j5, empty" [ref=e224] [cursor=pointer]
                  - button "k5, empty" [ref=e225] [cursor=pointer]
                  - button "l5, empty" [ref=e226] [cursor=pointer]
                  - button "3L, m5, triple letter, empty" [ref=e227] [cursor=pointer]:
                    - generic [ref=e228]: 3L
                  - button "n5, empty" [ref=e229] [cursor=pointer]
                  - button "3W, o5, triple word, empty" [ref=e230] [cursor=pointer]:
                    - generic [ref=e231]: 3W
                  - generic [ref=e232]: "6"
                  - button "a6, empty" [ref=e233] [cursor=pointer]
                  - button "b6, empty" [ref=e234] [cursor=pointer]
                  - button "c6, empty" [ref=e235] [cursor=pointer]
                  - button "d6, empty" [ref=e236] [cursor=pointer]
                  - button "e6, empty" [ref=e237] [cursor=pointer]
                  - button "f6, empty" [ref=e238] [cursor=pointer]
                  - button "g6, empty" [ref=e239] [cursor=pointer]
                  - button "3L, h6, triple letter, empty" [ref=e240] [cursor=pointer]:
                    - generic [ref=e241]: 3L
                  - button "i6, empty" [ref=e242] [cursor=pointer]
                  - button "j6, empty" [ref=e243] [cursor=pointer]
                  - button "k6, empty" [ref=e244] [cursor=pointer]
                  - button "l6, empty" [ref=e245] [cursor=pointer]
                  - button "m6, empty" [ref=e246] [cursor=pointer]
                  - button "n6, empty" [ref=e247] [cursor=pointer]
                  - button "o6, empty" [ref=e248] [cursor=pointer]
                  - generic [ref=e249]: "7"
                  - button "a7, empty" [ref=e250] [cursor=pointer]
                  - button "2W, b7, double word, empty" [ref=e251] [cursor=pointer]:
                    - generic [ref=e252]: 2W
                  - button "c7, empty" [ref=e253] [cursor=pointer]
                  - button "d7, empty" [ref=e254] [cursor=pointer]
                  - button "2L, e7, double letter, empty" [ref=e255] [cursor=pointer]:
                    - generic [ref=e256]: 2L
                  - button "f7, empty" [ref=e257] [cursor=pointer]
                  - button "2L, g7, double letter, empty" [ref=e258] [cursor=pointer]:
                    - generic [ref=e259]: 2L
                  - button "h7, empty" [ref=e260] [cursor=pointer]
                  - button "2L, i7, double letter, empty" [ref=e261] [cursor=pointer]:
                    - generic [ref=e262]: 2L
                  - button "j7, empty" [ref=e263] [cursor=pointer]
                  - button "2L, k7, double letter, empty" [ref=e264] [cursor=pointer]:
                    - generic [ref=e265]: 2L
                  - button "l7, empty" [ref=e266] [cursor=pointer]
                  - button "m7, empty" [ref=e267] [cursor=pointer]
                  - button "2W, n7, double word, empty" [ref=e268] [cursor=pointer]:
                    - generic [ref=e269]: 2W
                  - button "o7, empty" [ref=e270] [cursor=pointer]
                  - generic [ref=e271]: "8"
                  - button "2L, a8, double letter, empty" [ref=e272] [cursor=pointer]:
                    - generic [ref=e273]: 2L
                  - button "b8, empty" [ref=e274] [cursor=pointer]
                  - button "c8, empty" [ref=e275] [cursor=pointer]
                  - button "d8, empty" [ref=e276] [cursor=pointer]
                  - button "e8, empty" [ref=e277] [cursor=pointer]
                  - button "3L, f8, triple letter, empty" [ref=e278] [cursor=pointer]:
                    - generic [ref=e279]: 3L
                  - button "C 3, g8, committed" [disabled] [ref=e280]:
                    - generic [ref=e281]: C
                    - generic [ref=e282]: "3"
                  - button "A 1, h8, committed" [disabled] [ref=e283]:
                    - generic [ref=e284]: A
                    - generic [ref=e285]: "1"
                  - button "T 1, i8, committed" [disabled] [ref=e286]:
                    - generic [ref=e287]: T
                    - generic [ref=e288]: "1"
                  - button "3L, j8, triple letter, empty" [ref=e289] [cursor=pointer]:
                    - generic [ref=e290]: 3L
                  - button "k8, empty" [ref=e291] [cursor=pointer]
                  - button "l8, empty" [ref=e292] [cursor=pointer]
                  - button "m8, empty" [ref=e293] [cursor=pointer]
                  - button "n8, empty" [ref=e294] [cursor=pointer]
                  - button "2L, o8, double letter, empty" [ref=e295] [cursor=pointer]:
                    - generic [ref=e296]: 2L
                  - generic [ref=e297]: "9"
                  - button "a9, empty" [ref=e298] [cursor=pointer]
                  - button "2W, b9, double word, empty" [ref=e299] [cursor=pointer]:
                    - generic [ref=e300]: 2W
                  - button "c9, empty" [ref=e301] [cursor=pointer]
                  - button "d9, empty" [ref=e302] [cursor=pointer]
                  - button "2L, e9, double letter, empty" [ref=e303] [cursor=pointer]:
                    - generic [ref=e304]: 2L
                  - button "f9, empty" [ref=e305] [cursor=pointer]
                  - button "2L, g9, double letter, empty" [ref=e306] [cursor=pointer]:
                    - generic [ref=e307]: 2L
                  - button "h9, empty" [ref=e308] [cursor=pointer]
                  - button "2L, i9, double letter, empty" [ref=e309] [cursor=pointer]:
                    - generic [ref=e310]: 2L
                  - button "j9, empty" [ref=e311] [cursor=pointer]
                  - button "2L, k9, double letter, empty" [ref=e312] [cursor=pointer]:
                    - generic [ref=e313]: 2L
                  - button "l9, empty" [ref=e314] [cursor=pointer]
                  - button "m9, empty" [ref=e315] [cursor=pointer]
                  - button "2W, n9, double word, empty" [ref=e316] [cursor=pointer]:
                    - generic [ref=e317]: 2W
                  - button "o9, empty" [ref=e318] [cursor=pointer]
                  - generic [ref=e319]: "10"
                  - button "a10, empty" [ref=e320] [cursor=pointer]
                  - button "b10, empty" [ref=e321] [cursor=pointer]
                  - button "c10, empty" [ref=e322] [cursor=pointer]
                  - button "d10, empty" [ref=e323] [cursor=pointer]
                  - button "e10, empty" [ref=e324] [cursor=pointer]
                  - button "f10, empty" [ref=e325] [cursor=pointer]
                  - button "g10, empty" [ref=e326] [cursor=pointer]
                  - button "3L, h10, triple letter, empty" [ref=e327] [cursor=pointer]:
                    - generic [ref=e328]: 3L
                  - button "i10, empty" [ref=e329] [cursor=pointer]
                  - button "j10, empty" [ref=e330] [cursor=pointer]
                  - button "k10, empty" [ref=e331] [cursor=pointer]
                  - button "l10, empty" [ref=e332] [cursor=pointer]
                  - button "m10, empty" [ref=e333] [cursor=pointer]
                  - button "n10, empty" [ref=e334] [cursor=pointer]
                  - button "o10, empty" [ref=e335] [cursor=pointer]
                  - generic [ref=e336]: "11"
                  - button "3W, a11, triple word, empty" [ref=e337] [cursor=pointer]:
                    - generic [ref=e338]: 3W
                  - button "b11, empty" [ref=e339] [cursor=pointer]
                  - button "3L, c11, triple letter, empty" [ref=e340] [cursor=pointer]:
                    - generic [ref=e341]: 3L
                  - button "d11, empty" [ref=e342] [cursor=pointer]
                  - button "e11, empty" [ref=e343] [cursor=pointer]
                  - button "f11, empty" [ref=e344] [cursor=pointer]
                  - button "2L, g11, double letter, empty" [ref=e345] [cursor=pointer]:
                    - generic [ref=e346]: 2L
                  - button "h11, empty" [ref=e347] [cursor=pointer]
                  - button "2L, i11, double letter, empty" [ref=e348] [cursor=pointer]:
                    - generic [ref=e349]: 2L
                  - button "j11, empty" [ref=e350] [cursor=pointer]
                  - button "k11, empty" [ref=e351] [cursor=pointer]
                  - button "l11, empty" [ref=e352] [cursor=pointer]
                  - button "3L, m11, triple letter, empty" [ref=e353] [cursor=pointer]:
                    - generic [ref=e354]: 3L
                  - button "n11, empty" [ref=e355] [cursor=pointer]
                  - button "3W, o11, triple word, empty" [ref=e356] [cursor=pointer]:
                    - generic [ref=e357]: 3W
                  - generic [ref=e358]: "12"
                  - button "a12, empty" [ref=e359] [cursor=pointer]
                  - button "2L, b12, double letter, empty" [ref=e360] [cursor=pointer]:
                    - generic [ref=e361]: 2L
                  - button "c12, empty" [ref=e362] [cursor=pointer]
                  - button "2W, d12, double word, empty" [ref=e363] [cursor=pointer]:
                    - generic [ref=e364]: 2W
                  - button "e12, empty" [ref=e365] [cursor=pointer]
                  - button "f12, empty" [ref=e366] [cursor=pointer]
                  - button "g12, empty" [ref=e367] [cursor=pointer]
                  - button "h12, empty" [ref=e368] [cursor=pointer]
                  - button "i12, empty" [ref=e369] [cursor=pointer]
                  - button "j12, empty" [ref=e370] [cursor=pointer]
                  - button "k12, empty" [ref=e371] [cursor=pointer]
                  - button "2W, l12, double word, empty" [ref=e372] [cursor=pointer]:
                    - generic [ref=e373]: 2W
                  - button "m12, empty" [ref=e374] [cursor=pointer]
                  - button "2L, n12, double letter, empty" [ref=e375] [cursor=pointer]:
                    - generic [ref=e376]: 2L
                  - button "o12, empty" [ref=e377] [cursor=pointer]
                  - generic [ref=e378]: "13"
                  - button "a13, empty" [ref=e379] [cursor=pointer]
                  - button "b13, empty" [ref=e380] [cursor=pointer]
                  - button "c13, empty" [ref=e381] [cursor=pointer]
                  - button "d13, empty" [ref=e382] [cursor=pointer]
                  - button "3L, e13, triple letter, empty" [ref=e383] [cursor=pointer]:
                    - generic [ref=e384]: 3L
                  - button "f13, empty" [ref=e385] [cursor=pointer]
                  - button "g13, empty" [ref=e386] [cursor=pointer]
                  - button "h13, empty" [ref=e387] [cursor=pointer]
                  - button "i13, empty" [ref=e388] [cursor=pointer]
                  - button "j13, empty" [ref=e389] [cursor=pointer]
                  - button "3L, k13, triple letter, empty" [ref=e390] [cursor=pointer]:
                    - generic [ref=e391]: 3L
                  - button "l13, empty" [ref=e392] [cursor=pointer]
                  - button "m13, empty" [ref=e393] [cursor=pointer]
                  - button "n13, empty" [ref=e394] [cursor=pointer]
                  - button "o13, empty" [ref=e395] [cursor=pointer]
                  - generic [ref=e396]: "14"
                  - button "a14, empty" [ref=e397] [cursor=pointer]
                  - button "b14, empty" [ref=e398] [cursor=pointer]
                  - button "c14, empty" [ref=e399] [cursor=pointer]
                  - button "2L, d14, double letter, empty" [ref=e400] [cursor=pointer]:
                    - generic [ref=e401]: 2L
                  - button "e14, empty" [ref=e402] [cursor=pointer]
                  - button "f14, empty" [ref=e403] [cursor=pointer]
                  - button "2W, g14, double word, empty" [ref=e404] [cursor=pointer]:
                    - generic [ref=e405]: 2W
                  - button "h14, empty" [ref=e406] [cursor=pointer]
                  - button "2W, i14, double word, empty" [ref=e407] [cursor=pointer]:
                    - generic [ref=e408]: 2W
                  - button "j14, empty" [ref=e409] [cursor=pointer]
                  - button "k14, empty" [ref=e410] [cursor=pointer]
                  - button "2L, l14, double letter, empty" [ref=e411] [cursor=pointer]:
                    - generic [ref=e412]: 2L
                  - button "m14, empty" [ref=e413] [cursor=pointer]
                  - button "n14, empty" [ref=e414] [cursor=pointer]
                  - button "o14, empty" [ref=e415] [cursor=pointer]
                  - generic [ref=e416]: "15"
                  - button "2L, a15, double letter, empty" [ref=e417] [cursor=pointer]:
                    - generic [ref=e418]: 2L
                  - button "b15, empty" [ref=e419] [cursor=pointer]
                  - button "c15, empty" [ref=e420] [cursor=pointer]
                  - button "d15, empty" [ref=e421] [cursor=pointer]
                  - button "3W, e15, triple word, empty" [ref=e422] [cursor=pointer]:
                    - generic [ref=e423]: 3W
                  - button "f15, empty" [ref=e424] [cursor=pointer]
                  - button "g15, empty" [ref=e425] [cursor=pointer]
                  - button "2L, h15, double letter, empty" [ref=e426] [cursor=pointer]:
                    - generic [ref=e427]: 2L
                  - button "i15, empty" [ref=e428] [cursor=pointer]
                  - button "j15, empty" [ref=e429] [cursor=pointer]
                  - button "3W, k15, triple word, empty" [ref=e430] [cursor=pointer]:
                    - generic [ref=e431]: 3W
                  - button "l15, empty" [ref=e432] [cursor=pointer]
                  - button "m15, empty" [ref=e433] [cursor=pointer]
                  - button "n15, empty" [ref=e434] [cursor=pointer]
                  - button "2L, o15, double letter, empty" [ref=e435] [cursor=pointer]:
                    - generic [ref=e436]: 2L
              - img "Whole board overview; outline shows the enlarged area" [ref=e437]
        - status [ref=e665]:
          - generic [ref=e666]:
            - generic [ref=e667]: "Amber: avery. Teal: jordan_plays."
            - text: Teal — to play · 83 tiles in the bag
        - generic [ref=e670]:
          - generic [ref=e674]:
            - generic [ref=e675]:
              - img "Amber" [ref=e676]
              - generic [ref=e677]: avery
            - generic [ref=e680]: 7 tiles
          - generic [ref=e681]:
            - generic [ref=e682]: Score
            - generic [ref=e683]: "10"
      - region "Game record" [ref=e686]:
        - generic [ref=e687]:
          - heading "Game record" [level=2] [ref=e689]
          - paragraph [ref=e690]: Teal — to play · 83 tiles in the bag
        - generic [ref=e692]:
          - group "Game actions" [ref=e693]:
            - button "Offer draw" [ref=e694] [cursor=pointer]:
              - paragraph [ref=e697]: Offer draw
            - button "Resign game" [ref=e698] [cursor=pointer]:
              - paragraph [ref=e701]:
                - text: Resign
                - generic [ref=e702]: game
          - button "History and stats" [ref=e703] [cursor=pointer]:
            - paragraph [ref=e706]: History and stats
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