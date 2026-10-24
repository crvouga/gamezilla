@domain:journeys
Feature: Author and continue Numberlink packs
  When Alice shares her Numberlink creations with Bob, they want authoring and playing to work together, so a published pack remains playable and their work is kept wherever they return.

  Rule: An author can share a playtested Numberlink pack through the app

    Scenario: Another person discovers the author's ordered Numberlink pack
      When Alice authors, playtests and publishes a Numberlink pack from a fresh device
      Then Bob discovers the Numberlink pack in Alice's chosen order

  Rule: Numberlink work survives another device, later publication and time offline

    Scenario: Continuing on another device keeps the Numberlink attempt and pack progress
      When Bob plays a Numberlink pack, closes the app and continues on his other device
      Then Bob keeps his Numberlink attempt and can continue that pack

    Scenario: An earlier Numberlink pack stays playable after a new publication
      When Alice republishes Numberlink after Bob has started her pack
      Then Bob can resume his Numberlink attempt in the unchanged pack edition

    Scenario: Offline Numberlink authoring and play are shared when the connection returns
      When Alice authors Numberlink and Bob plays an available Numberlink pack offline
      Then both people keep their Numberlink work when the connection returns
