@domain:journeys
Feature: A matchmaking pair play a lasting multiplayer game
  When two people want to play chess together, they want to find each other
  and finish the game, so the complete journey keeps one shared result.

  Rule: Once paired for multiplayer chess, both people go straight to their board

    @regression:database-link-unmodeled-tcp-buffering
    @regression:chess-match-room-initial-delivery
    Scenario: Two accounts are matched and can finish their multiplayer game
      Given Alice and Bob have accounts on fresh devices
      And Alice is finding a 5+0 multiplayer chess opponent
      When Bob starts finding a 5+0 multiplayer chess opponent
      Then Alice and Bob have the same multiplayer chess game within 5 seconds
      When White and Black open with e4 and e5 in multiplayer chess
      When Bob resigns multiplayer chess
      Then both people see Alice won the multiplayer game

    @regression:journey-offline-live-browser-capability
    Scenario: Returning after time away opens the accepted multiplayer game
      Given Alice and Bob have accounts and an unfinished multiplayer chess game
      And Alice's device went offline before Bob resigned
      When Alice opens multiplayer chess with a connection again
      Then Alice sees the accepted multiplayer result

    Scenario: A guest starts finding an opponent without an account
      Given Alice is a guest on a fresh device
      When Alice starts finding a 5+0 multiplayer chess opponent
      Then Alice is finding a multiplayer chess opponent
      And Alice has no multiplayer chess game
