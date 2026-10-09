@domain:profile
Feature: Choose a username offline
  When a person chooses a username without a connection, they want their
  profile to show their choice, so they can carry on and share it when the
  connection returns.

  Rule: An offline choice appears locally under the username rules already known

    Scenario: A valid offline username appears on the person's profile
      Given Alice's username is @alice_one
      And Alice is offline
      When Alice tries to use username "alice_two"
      Then Alice's profile shows @alice_two
      And Alice is told their username change will be shared when the connection returns

    Scenario: An offline username that is not allowed is refused
      Given Alice's username is @alice_one
      And Alice is offline
      When Alice tries to use username "official_support"
      Then Alice's username change is refused because the name is not allowed
      And Alice's profile still shows @alice_one

    Scenario: An offline choice keeps another device on the last shared username
      Given Alice is signed in
      And Alice's username is @alice_one
      And Alice is also signed in on another device
      And Alice is offline
      When Alice tries to use username "alice_two"
      Then Alice's profile shows @alice_two
      And Alice's other device shows @alice_one

    Scenario: Reopening offline keeps an accepted username choice
      Given Alice's username is @alice_one
      And Alice is offline
      And Alice has renamed themselves to @alice_two
      When Alice closes and reopens the app
      Then Alice's profile shows @alice_two

  Rule: Returning shares an offline choice or clearly refuses it under the shared username rules

    Scenario: An offline username is shared with another device on return
      Given Alice is signed in
      And Alice's username is @alice_one
      And Alice is also signed in on another device
      And Alice is offline
      And Alice has renamed themselves to @alice_two
      When the connection comes back
      Then Alice's other device shows @alice_two within 30 seconds

    Scenario: A name claimed while the person is offline refuses their choice on return
      Given Alice's username is @alice_one
      And Alice is offline
      And Alice has renamed themselves to @knight_rider
      And Bob's username is @knight_rider
      When the connection comes back
      Then Alice's username change is refused because another person already has that name
      And Alice's profile shows @alice_one

    Scenario: A choice no longer allowed is refused when it is shared
      Given Alice's username is @alice_one
      And Alice is offline
      And Alice has renamed themselves to @chess_cheater
      And the team has stopped allowing the username @chess_cheater
      When the connection comes back
      Then Alice's username change is refused because the name is not allowed
      And Alice's profile shows @alice_one
