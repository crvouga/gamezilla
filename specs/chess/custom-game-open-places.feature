@domain:chess
Feature: Claim and release an open place
  When a side is available, someone in the space wants to take it, so nobody can take an occupied side or share control of it.

  Rule: An open place belongs to the first accepted claim

    Scenario: Someone in the space claims Black
      Given Alice has a configuring Custom Game
      And Bob is in Alice's space
      When Bob claims Black in the Custom Game
      Then Black is Bob in the Custom Game

    Scenario: An occupied side refuses a second claimant
      Given Alice has a Custom Game between Alice as White and Bob as Black
      And Carol is in Alice's space
      When Carol claims Black in the Custom Game
      Then Carol is told that side is not an open place

  Rule: Releasing a side is the participant's own choice

    Scenario: A participant releases Black before start
      Given Alice has a Custom Game between Alice as White and Bob as Black
      When Bob releases Black in the Custom Game
      Then Black is an open place in the Custom Game

    Scenario: Someone else cannot release Black
      Given Alice has a Custom Game between Alice as White and Bob as Black
      When Alice releases Black in the Custom Game
      Then Alice is told only that participant may release the side

  Rule: After start no person may acquire or release a side

    Scenario: A released place can be claimed again
      Given Alice has a configuring Custom Game
      And Bob has released Black in the Custom Game
      When Bob claims Black in the Custom Game
      Then Black is Bob in the Custom Game

    Scenario: An active participant cannot release their side
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      When Bob releases Black in the Custom Game
      Then Bob is told the Custom Game has already started

    Scenario: A completed game cannot acquire a new participant
      Given Alice has a completed Custom Game between Alice as White and Bob as Black
      And Carol is in Alice's space
      When Carol claims Black in the Custom Game
      Then Carol is told the Custom Game has finished

    Scenario: A cancelled game cannot acquire a new participant
      Given Alice has a cancelled Custom Game
      And Bob is in Alice's space
      When Bob claims Black in the Custom Game
      Then Bob is told the Custom Game was cancelled

  Rule: Competing claims cannot share an open place

    Scenario: Two claims leave exactly one participant
      Given Alice has a configuring Custom Game
      And Bob and Carol are in Alice's space
      When Bob and Carol claim Black at the same time
      Then Black is either Bob or Carol in the Custom Game
      And Black has at most one participant

    Scenario: A claim cannot take a place replaced by a bot
      Given Alice has a configuring Custom Game
      And Black has since been replaced by a bot
      When Bob claims Black in the Custom Game
      Then Bob is told that side is not an open place
