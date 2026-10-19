@domain:games
Feature: Claim and release an open side
  When a side of a custom game is open, someone in the space wants to take it, so nobody can take a side someone already has or share one.

  Rule: An open side belongs to the first claim the custom game accepts

    Scenario: Someone in the space claims the second side
      Given Alice is setting up a custom game
      And Bob is in Alice's space
      When Bob claims the second side
      Then the second side is Bob

    Scenario: An occupied side refuses a second claimant
      Given Alice is setting up a custom game with Bob on the second side
      And Carol is in Alice's space
      When Carol claims the second side
      Then Carol is told that side is not open

  Rule: Releasing a side is the participant's own choice

    Scenario: A participant releases the second side before the custom game starts
      Given Alice is setting up a custom game with Bob on the second side
      When Bob releases the second side
      Then the second side is open

    Scenario: Someone else cannot release the second side
      Given Alice is setting up a custom game with Bob on the second side
      When Alice releases the second side
      Then Alice is told only that participant may release the side

  Rule: After the custom game starts nobody takes or releases a side

    Scenario: A released side can be claimed again
      Given Alice is setting up a custom game
      And Bob has released the second side
      When Bob claims the second side
      Then the second side is Bob

    Scenario: A participant cannot release their side once the custom game is under way
      Given Alice and Bob have a custom game under way
      When Bob releases the second side
      Then Bob is told the custom game has already started

    Scenario: A finished game cannot gain a new participant
      Given Alice has a finished custom game
      And Carol is in Alice's space
      When Carol claims the second side
      Then Carol is told the game is finished

    Scenario: A cancelled game cannot gain a new participant
      Given Alice has a cancelled custom game
      And Bob is in Alice's space
      When Bob claims the second side
      Then Bob is told the custom game was cancelled

  Rule: Competing claims cannot share an open side

    Scenario: Two claims give the side to exactly one participant
      Given Alice is setting up a custom game
      And Bob and Carol are in Alice's space
      When Bob and Carol claim the second side at the same time
      Then the second side is either Bob or Carol
      And the second side has at most one participant

    Scenario: A claim cannot take a side replaced by a bot
      Given Alice is setting up a custom game
      And Alice has assigned a bot to the second side
      When Bob claims the second side
      Then Bob is told that side is not open
